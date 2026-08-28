import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import ts from "typescript"
import { PrismaClient, type Prisma } from "@prisma/client"

import { assertDisposableTarget } from "../lib/disposable-db"
import {
  createOwnershipFoundation,
  unwrapOwnershipResult,
  type SecurityUser,
  type ServerIdentitySource,
} from "../../src/lib/security/ownership"

const EXPECTED_DATABASE = "personalink_phase0_rehearsal_20260826_210704"
const invert = process.env.INVERT_ASSERTION === "1"
const failures: string[] = []
const checks: string[] = []
const coverage: string[] = []
const prisma = new PrismaClient()
const nativeRequire = createRequire(import.meta.url)
const prefix = `lane-a-${process.pid}-${Date.now()}`

function check(name: string, condition: unknown, central = false): void {
  checks.push(name)
  const passed = central && invert ? !condition : Boolean(condition)
  if (!passed) failures.push(name)
}

type TestProfile = Readonly<{ id: string }>
class MutableIdentity implements ServerIdentitySource<TestProfile> {
  current: SecurityUser<TestProfile> | null = null
  async resolve(): Promise<SecurityUser<TestProfile> | null> { return this.current }
}

const identity = new MutableIdentity()
const foundation = createOwnershipFoundation(identity)
const effects = { revalidations: 0, cookies: 0, embeddings: 0 }

function errorShape(error: unknown): string {
  if (!(error instanceof Error)) return JSON.stringify({ name: typeof error, message: String(error) })
  const tagged = error as Error & { code?: unknown; status?: unknown }
  return JSON.stringify({ name: error.name, message: error.message, code: tagged.code, status: tagged.status })
}

async function captureError(invoke: () => Promise<unknown>): Promise<unknown | null> {
  try { await invoke(); return null } catch (error) { return error }
}

type TransactionalClient = Prisma.TransactionClient & {
  $transaction: <T>(callback: (inner: Prisma.TransactionClient) => Promise<T>) => Promise<T>
}

function transactionalClient(tx: Prisma.TransactionClient): TransactionalClient {
  const proxy = new Proxy(tx as TransactionalClient, {
    get(target, property, receiver) {
      if (property === "$transaction") return async <T>(callback: (inner: Prisma.TransactionClient) => Promise<T>) => callback(proxy)
      const value = Reflect.get(target, property, receiver)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
  return proxy
}

type ActionModule = Record<string, (...args: unknown[]) => Promise<unknown>>

function loadActionModule(relativePath: string, scopedPrisma: ReturnType<typeof transactionalClient>): ActionModule {
  const filename = path.resolve(relativePath)
  const source = fs.readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const loadedModule = { exports: {} as ActionModule }
  const localRequire = (request: string): unknown => {
    if (request === "@/lib/prisma") return { prisma: scopedPrisma }
    if (request === "@/lib/security") return {
      requireAuthenticatedUser: foundation.requireAuthenticatedUser,
      requireOwnedProfile: foundation.requireOwnedProfile,
      requireOwnedResource: foundation.requireOwnedResource,
      executeOwnedResourceWrite: foundation.executeOwnedResourceWrite,
      unwrapOwnershipResult,
    }
    if (request === "next/cache") return { revalidatePath: () => { effects.revalidations += 1 } }
    if (request === "next/headers") return { cookies: async () => ({ set: () => { effects.cookies += 1 } }) }
    if (request === "@/lib/onboarding-needs") return {
      extrasFromAddons: () => ({}),
      needById: () => ({ next: "/dashboard" }),
    }
    if (request === "@/lib/surfaces") return { writeExtras: (value: string | null) => value }
    if (request === "@/lib/try-kits") return { ACTIVE_PROFILE_COOKIE: "active-profile" }
    if (request === "@/lib/embeddings") return {
      embedDocument: async () => { effects.embeddings += 1 },
    }
    if (request === "@/lib/commerce") return { variantsToJson: (value: string) => value }
    if (request === "@/lib/menu") return { parseDiet: (value?: string) => value?.trim() || null }
    return nativeRequire(request)
  }
  const execute = new Function("exports", "require", "module", "__filename", "__dirname", output)
  execute(loadedModule.exports, localRequire, loadedModule, filename, path.dirname(filename))
  return loadedModule.exports
}

type ProtectedCase = {
  name: string
  anonymous: () => Promise<unknown>
  foreign: () => Promise<unknown>
  missing: () => Promise<unknown>
  owner: () => Promise<unknown>
  state: () => Promise<unknown>
  ownerSucceeded: () => Promise<boolean>
  ownerIdentity: SecurityUser<TestProfile>
  central?: boolean
}

async function protectedCase(test: ProtectedCase): Promise<void> {
  identity.current = null
  const anonymousBefore = JSON.stringify({ db: await test.state(), effects: { ...effects } })
  const anonymousError = await captureError(test.anonymous)
  const anonymousAfter = JSON.stringify({ db: await test.state(), effects: { ...effects } })
  check(`${test.name}: anonymous is 401 UNAUTHORIZED`,
    errorShape(anonymousError).includes('"code":"UNAUTHORIZED"') && errorShape(anonymousError).includes('"status":401'),
    test.central)
  check(`${test.name}: anonymous refusal has no write or side effect`, anonymousBefore === anonymousAfter)

  identity.current = test.ownerIdentity
  const foreignBefore = JSON.stringify({ db: await test.state(), effects: { ...effects } })
  const foreignError = await captureError(test.foreign)
  const foreignAfter = JSON.stringify({ db: await test.state(), effects: { ...effects } })
  check(`${test.name}: foreign tenant is 403 FORBIDDEN`,
    errorShape(foreignError).includes('"code":"FORBIDDEN"') && errorShape(foreignError).includes('"status":403'))
  check(`${test.name}: foreign refusal has no write or side effect`, foreignBefore === foreignAfter)

  const missingBefore = JSON.stringify({ db: await test.state(), effects: { ...effects } })
  const missingError = await captureError(test.missing)
  const missingAfter = JSON.stringify({ db: await test.state(), effects: { ...effects } })
  check(`${test.name}: missing id is 403 FORBIDDEN`,
    errorShape(missingError).includes('"code":"FORBIDDEN"') && errorShape(missingError).includes('"status":403'))
  check(`${test.name}: missing refusal has no write or side effect`, missingBefore === missingAfter)
  check(`${test.name}: foreign and missing refusals are indistinguishable`, errorShape(foreignError) === errorShape(missingError))

  await test.owner()
  check(`${test.name}: valid owner succeeds`, await test.ownerSucceeded())
  coverage.push(test.name)
}

type PublicCase = {
  name: string
  anonymous: () => Promise<unknown>
  authenticatedForeign: () => Promise<unknown>
  owner: () => Promise<unknown>
  anonymousSucceeded: () => Promise<boolean>
  foreignSucceeded: () => Promise<boolean>
  ownerSucceeded: () => Promise<boolean>
  ownerIdentity: SecurityUser<TestProfile>
}

async function publicCase(test: PublicCase): Promise<void> {
  identity.current = null
  const anonymousError = await captureError(test.anonymous)
  check(`${test.name}: anonymous visitor flow remains public`, anonymousError === null && await test.anonymousSucceeded())
  identity.current = test.ownerIdentity
  const foreignError = await captureError(test.authenticatedForeign)
  check(`${test.name}: authenticated visitor may use another tenant public surface`, foreignError === null && await test.foreignSucceeded())
  const ownerError = await captureError(test.owner)
  check(`${test.name}: owner can use the same public surface`, ownerError === null && await test.ownerSucceeded())
  coverage.push(`${test.name} (intentional public flow)`)
}

const productData = (title: string) => ({
  title,
  type: "OTHER" as const,
  price: 12,
  isActive: true,
})

class RollbackProof extends Error {}

async function runSuite(tx: Prisma.TransactionClient): Promise<void> {
  const db = transactionalClient(tx)
  const onboarding = loadActionModule("src/app/actions/onboarding.ts", db)
  const content = loadActionModule("src/app/actions/content.ts", db)
  const products = loadActionModule("src/app/actions/products.ts", db)
  const shortLinks = loadActionModule("src/app/actions/short-links.ts", db)

  const ownerUserId = `${prefix}-owner-user`
  const foreignUserId = `${prefix}-foreign-user`
  const ownerProfileId = `${prefix}-owner-profile`
  const foreignProfileId = `${prefix}-foreign-profile`
  await tx.user.createMany({ data: [
    { id: ownerUserId, clerkId: `${prefix}-owner-clerk`, email: `${prefix}-owner@example.invalid` },
    { id: foreignUserId, clerkId: `${prefix}-foreign-clerk`, email: `${prefix}-foreign@example.invalid` },
  ] })
  await tx.profile.createMany({ data: [
    { id: ownerProfileId, userId: ownerUserId, slug: `${prefix}-owner`, displayName: "Lane A Owner", roleTemplate: "CUSTOM", primaryGoal: "TEST" },
    { id: foreignProfileId, userId: foreignUserId, slug: `${prefix}-foreign`, displayName: "Lane A Foreign", roleTemplate: "CUSTOM", primaryGoal: "TEST" },
  ] })
  const ownerIdentity = Object.freeze({ id: ownerUserId, profiles: Object.freeze([{ id: ownerProfileId }]) })

  const docIds = {
    ownerUpdate: `${prefix}-doc-owner-update`, foreignUpdate: `${prefix}-doc-foreign-update`,
    ownerDelete: `${prefix}-doc-owner-delete`, foreignDelete: `${prefix}-doc-foreign-delete`,
  }
  await tx.profileDocument.createMany({ data: [
    { id: docIds.ownerUpdate, profileId: ownerProfileId, type: "TEXT", sourceType: "TEXT", title: "owner update", rawText: "before" },
    { id: docIds.foreignUpdate, profileId: foreignProfileId, type: "TEXT", sourceType: "TEXT", title: "foreign update", rawText: "foreign before" },
    { id: docIds.ownerDelete, profileId: ownerProfileId, type: "TEXT", sourceType: "TEXT", title: "owner delete", rawText: "owner" },
    { id: docIds.foreignDelete, profileId: foreignProfileId, type: "TEXT", sourceType: "TEXT", title: "foreign delete", rawText: "foreign" },
  ] })
  await tx.conversation.create({
    data: {
      id: `${prefix}-conversation-owner`, profileId: ownerProfileId, visitorName: "Owner visitor",
      messages: { create: { id: `${prefix}-message-owner`, senderType: "VISITOR", role: "user", text: "Owner knowledge" } },
    },
  })
  await tx.conversation.create({
    data: {
      id: `${prefix}-conversation-foreign`, profileId: foreignProfileId, visitorName: "Foreign visitor",
      messages: { create: { id: `${prefix}-message-foreign`, senderType: "VISITOR", role: "user", text: "Foreign knowledge" } },
    },
  })

  const productIds = {
    ownerUpdate: `${prefix}-product-owner-update`, foreignUpdate: `${prefix}-product-foreign-update`,
    ownerDelete: `${prefix}-product-owner-delete`, foreignDelete: `${prefix}-product-foreign-delete`,
    ownerActive: `${prefix}-product-owner-active`, foreignActive: `${prefix}-product-foreign-active`,
    ownerOrder: `${prefix}-product-owner-order`, foreignOrder: `${prefix}-product-foreign-order`,
    ownerPublic: `${prefix}-product-owner-public`, foreignPublic: `${prefix}-product-foreign-public`,
  }
  await tx.digitalProduct.createMany({ data: Object.entries(productIds).map(([key, id]) => ({
    id,
    profileId: key.startsWith("owner") ? ownerProfileId : foreignProfileId,
    title: key,
    type: "OTHER",
    priceCents: 1200,
    currency: "USD",
    isActive: !key.includes("Active"),
  })) })
  const purchases = {
    owner: `${prefix}-purchase-owner`, foreign: `${prefix}-purchase-foreign`,
  }
  await tx.productPurchase.createMany({ data: [
    { id: purchases.owner, productId: productIds.ownerOrder, visitorEmail: "owner@example.invalid", status: "PENDING", payMethod: "UPI" },
    { id: purchases.foreign, productId: productIds.foreignOrder, visitorEmail: "foreign@example.invalid", status: "PENDING", payMethod: "UPI" },
  ] })

  const linkIds = {
    ownerUpdate: `${prefix}-link-owner-update`, foreignUpdate: `${prefix}-link-foreign-update`,
    ownerDelete: `${prefix}-link-owner-delete`, foreignDelete: `${prefix}-link-foreign-delete`,
  }
  await tx.shortLink.createMany({ data: [
    { id: linkIds.ownerUpdate, profileId: ownerProfileId, code: `${prefix}-ou`, targetUrl: "https://example.invalid/ou" },
    { id: linkIds.foreignUpdate, profileId: foreignProfileId, code: `${prefix}-fu`, targetUrl: "https://example.invalid/fu" },
    { id: linkIds.ownerDelete, profileId: ownerProfileId, code: `${prefix}-od`, targetUrl: "https://example.invalid/od" },
    { id: linkIds.foreignDelete, profileId: foreignProfileId, code: `${prefix}-fd`, targetUrl: "https://example.invalid/fd" },
  ] })

  await protectedCase({
    name: "createProfile", ownerIdentity, central: true,
    anonymous: () => onboarding.createProfile({ displayName: "Anonymous", roleTemplate: "CUSTOM", primaryGoal: "TEST" }),
    foreign: () => onboarding.createProfile(foreignUserId, { displayName: "Foreign claim", roleTemplate: "CUSTOM", primaryGoal: "TEST" }),
    missing: () => onboarding.createProfile(`${prefix}-missing-user`, { displayName: "Missing claim", roleTemplate: "CUSTOM", primaryGoal: "TEST" }),
    owner: () => onboarding.createProfile({ displayName: `${prefix} safe profile`, roleTemplate: "CUSTOM", primaryGoal: "TEST" }),
    state: () => tx.profile.count({ where: { userId: ownerUserId } }),
    ownerSucceeded: async () => await tx.profile.count({ where: { userId: ownerUserId } }) === 2,
  })
  await protectedCase({
    name: "addContent", ownerIdentity,
    anonymous: () => content.addContent(ownerProfileId, { type: "TEXT", title: "anon", content: "anon" }),
    foreign: () => content.addContent(foreignProfileId, { type: "TEXT", title: "foreign", content: "foreign" }),
    missing: () => content.addContent(`${prefix}-missing-profile`, { type: "TEXT", title: "missing", content: "missing" }),
    owner: () => content.addContent(ownerProfileId, { type: "TEXT", title: `${prefix}-added`, content: "owner" }),
    state: () => tx.profileDocument.count(),
    ownerSucceeded: async () => await tx.profileDocument.count({ where: { profileId: ownerProfileId, title: `${prefix}-added` } }) === 1,
  })
  await protectedCase({
    name: "updateContent", ownerIdentity,
    anonymous: () => content.updateContent(docIds.ownerUpdate, { title: "anon", content: "anon" }),
    foreign: () => content.updateContent(docIds.foreignUpdate, { title: "forbidden", content: "forbidden" }),
    missing: () => content.updateContent(`${prefix}-missing-doc`, { title: "missing", content: "missing" }),
    owner: () => content.updateContent(docIds.ownerUpdate, { title: "owner updated", content: "after" }),
    state: () => tx.profileDocument.findMany({ where: { id: { in: [docIds.ownerUpdate, docIds.foreignUpdate] } }, select: { id: true, title: true, rawText: true }, orderBy: { id: "asc" } }),
    ownerSucceeded: async () => (await tx.profileDocument.findUnique({ where: { id: docIds.ownerUpdate } }))?.rawText === "after",
  })
  await protectedCase({
    name: "syncKnowledgeFromChats", ownerIdentity,
    anonymous: () => content.syncKnowledgeFromChats(ownerProfileId),
    foreign: () => content.syncKnowledgeFromChats(foreignProfileId),
    missing: () => content.syncKnowledgeFromChats(`${prefix}-missing-profile`),
    owner: () => content.syncKnowledgeFromChats(ownerProfileId),
    state: () => tx.profileDocument.count({ where: { sourceType: "CHAT_SUMMARY" } }),
    ownerSucceeded: async () => await tx.profileDocument.count({ where: { profileId: ownerProfileId, sourceType: "CHAT_SUMMARY" } }) === 1,
  })
  await protectedCase({
    name: "deleteContent", ownerIdentity,
    anonymous: () => content.deleteContent(docIds.ownerDelete),
    foreign: () => content.deleteContent(docIds.foreignDelete),
    missing: () => content.deleteContent(`${prefix}-missing-doc-delete`),
    owner: () => content.deleteContent(docIds.ownerDelete),
    state: () => tx.profileDocument.findMany({ where: { id: { in: [docIds.ownerDelete, docIds.foreignDelete] } }, select: { id: true } }),
    ownerSucceeded: async () => await tx.profileDocument.count({ where: { id: docIds.ownerDelete } }) === 0,
  })

  await protectedCase({
    name: "createProduct", ownerIdentity,
    anonymous: () => products.createProduct(ownerProfileId, productData("anon product")),
    foreign: () => products.createProduct(foreignProfileId, productData("foreign product")),
    missing: () => products.createProduct(`${prefix}-missing-profile`, productData("missing product")),
    owner: () => products.createProduct(ownerProfileId, productData(`${prefix}-created-product`)),
    state: () => tx.digitalProduct.count(),
    ownerSucceeded: async () => await tx.digitalProduct.count({ where: { profileId: ownerProfileId, title: `${prefix}-created-product` } }) === 1,
  })
  await protectedCase({
    name: "updateProduct", ownerIdentity,
    anonymous: () => products.updateProduct(productIds.ownerUpdate, productData("anon update")),
    foreign: () => products.updateProduct(productIds.foreignUpdate, productData("forbidden update")),
    missing: () => products.updateProduct(`${prefix}-missing-product`, productData("missing update")),
    owner: () => products.updateProduct(productIds.ownerUpdate, productData("owner updated product")),
    state: () => tx.digitalProduct.findMany({ where: { id: { in: [productIds.ownerUpdate, productIds.foreignUpdate] } }, select: { id: true, title: true }, orderBy: { id: "asc" } }),
    ownerSucceeded: async () => (await tx.digitalProduct.findUnique({ where: { id: productIds.ownerUpdate } }))?.title === "owner updated product",
  })
  await protectedCase({
    name: "deleteProduct", ownerIdentity,
    anonymous: () => products.deleteProduct(productIds.ownerDelete),
    foreign: () => products.deleteProduct(productIds.foreignDelete),
    missing: () => products.deleteProduct(`${prefix}-missing-product-delete`),
    owner: () => products.deleteProduct(productIds.ownerDelete),
    state: () => tx.digitalProduct.findMany({ where: { id: { in: [productIds.ownerDelete, productIds.foreignDelete] } }, select: { id: true } }),
    ownerSucceeded: async () => await tx.digitalProduct.count({ where: { id: productIds.ownerDelete } }) === 0,
  })
  await protectedCase({
    name: "setProductActive", ownerIdentity,
    anonymous: () => products.setProductActive(productIds.ownerActive, true),
    foreign: () => products.setProductActive(productIds.foreignActive, true),
    missing: () => products.setProductActive(`${prefix}-missing-product-active`, true),
    owner: () => products.setProductActive(productIds.ownerActive, true),
    state: () => tx.digitalProduct.findMany({ where: { id: { in: [productIds.ownerActive, productIds.foreignActive] } }, select: { id: true, isActive: true }, orderBy: { id: "asc" } }),
    ownerSucceeded: async () => (await tx.digitalProduct.findUnique({ where: { id: productIds.ownerActive } }))?.isActive === true,
  })
  await protectedCase({
    name: "confirmProductOrder", ownerIdentity,
    anonymous: () => products.confirmProductOrder(purchases.owner),
    foreign: () => products.confirmProductOrder(purchases.foreign),
    missing: () => products.confirmProductOrder(`${prefix}-missing-purchase`),
    owner: () => products.confirmProductOrder(purchases.owner),
    state: () => tx.productPurchase.findMany({ where: { id: { in: [purchases.owner, purchases.foreign] } }, select: { id: true, status: true, confirmedAt: true }, orderBy: { id: "asc" } }),
    ownerSucceeded: async () => (await tx.productPurchase.findUnique({ where: { id: purchases.owner } }))?.status === "COMPLETED",
  })

  await protectedCase({
    name: "createShortLink", ownerIdentity,
    anonymous: () => shortLinks.createShortLink(ownerProfileId, { targetUrl: "https://example.invalid/anon", code: `${prefix}-anon`, isActive: true }),
    foreign: () => shortLinks.createShortLink(foreignProfileId, { targetUrl: "https://example.invalid/foreign", code: `${prefix}-foreign-create`, isActive: true }),
    missing: () => shortLinks.createShortLink(`${prefix}-missing-profile`, { targetUrl: "https://example.invalid/missing", code: `${prefix}-missing-create`, isActive: true }),
    owner: () => shortLinks.createShortLink(ownerProfileId, { targetUrl: "https://example.invalid/owner", code: `${prefix}-owner-create`, isActive: true }),
    state: () => tx.shortLink.count(),
    ownerSucceeded: async () => await tx.shortLink.count({ where: { profileId: ownerProfileId, code: `${prefix}-owner-create` } }) === 1,
  })
  await protectedCase({
    name: "updateShortLink", ownerIdentity,
    anonymous: () => shortLinks.updateShortLink(linkIds.ownerUpdate, { targetUrl: "https://example.invalid/anon-update", isActive: true }),
    foreign: () => shortLinks.updateShortLink(linkIds.foreignUpdate, { targetUrl: "https://example.invalid/forbidden-update", isActive: true }),
    missing: () => shortLinks.updateShortLink(`${prefix}-missing-link`, { targetUrl: "https://example.invalid/missing-update", isActive: true }),
    owner: () => shortLinks.updateShortLink(linkIds.ownerUpdate, { targetUrl: "https://example.invalid/owner-updated", isActive: false }),
    state: () => tx.shortLink.findMany({ where: { id: { in: [linkIds.ownerUpdate, linkIds.foreignUpdate] } }, select: { id: true, targetUrl: true, isActive: true }, orderBy: { id: "asc" } }),
    ownerSucceeded: async () => (await tx.shortLink.findUnique({ where: { id: linkIds.ownerUpdate } }))?.targetUrl === "https://example.invalid/owner-updated",
  })
  await protectedCase({
    name: "deleteShortLink", ownerIdentity,
    anonymous: () => shortLinks.deleteShortLink(linkIds.ownerDelete),
    foreign: () => shortLinks.deleteShortLink(linkIds.foreignDelete),
    missing: () => shortLinks.deleteShortLink(`${prefix}-missing-link-delete`),
    owner: () => shortLinks.deleteShortLink(linkIds.ownerDelete),
    state: () => tx.shortLink.findMany({ where: { id: { in: [linkIds.ownerDelete, linkIds.foreignDelete] } }, select: { id: true } }),
    ownerSucceeded: async () => await tx.shortLink.count({ where: { id: linkIds.ownerDelete } }) === 0,
  })

  const publicCounts = async () => ({
    purchases: await tx.productPurchase.count({ where: { visitorEmail: { startsWith: prefix } } }),
    payments: await tx.payment.count({ where: { providerPaymentId: { startsWith: prefix } } }),
    reviews: await tx.offerReview.count({ where: { visitorName: { startsWith: prefix } } }),
  })
  let before = await publicCounts()
  await publicCase({
    name: "placeManualOrder", ownerIdentity,
    anonymous: () => products.placeManualOrder({ productId: productIds.foreignPublic, visitorName: "Anon", visitorEmail: `${prefix}-manual-anon`, payMethod: "UPI" }),
    authenticatedForeign: () => products.placeManualOrder({ productId: productIds.foreignPublic, visitorName: "Foreign", visitorEmail: `${prefix}-manual-foreign`, payMethod: "UPI" }),
    owner: () => products.placeManualOrder({ productId: productIds.ownerPublic, visitorName: "Owner", visitorEmail: `${prefix}-manual-owner`, payMethod: "UPI" }),
    anonymousSucceeded: async () => (await publicCounts()).purchases === before.purchases + 1,
    foreignSucceeded: async () => (await publicCounts()).purchases === before.purchases + 2,
    ownerSucceeded: async () => (await publicCounts()).purchases === before.purchases + 3,
  })
  before = await publicCounts()
  await publicCase({
    name: "placeCartOrder", ownerIdentity,
    anonymous: () => products.placeCartOrder({ lines: [{ productId: productIds.foreignPublic, qty: 1 }], visitorName: "Anon", visitorEmail: `${prefix}-cart-anon`, payMethod: "UPI" }),
    authenticatedForeign: () => products.placeCartOrder({ lines: [{ productId: productIds.foreignPublic, qty: 1 }], visitorName: "Foreign", visitorEmail: `${prefix}-cart-foreign`, payMethod: "UPI" }),
    owner: () => products.placeCartOrder({ lines: [{ productId: productIds.ownerPublic, qty: 1 }], visitorName: "Owner", visitorEmail: `${prefix}-cart-owner`, payMethod: "UPI" }),
    anonymousSucceeded: async () => (await publicCounts()).purchases === before.purchases + 1,
    foreignSucceeded: async () => (await publicCounts()).purchases === before.purchases + 2,
    ownerSucceeded: async () => (await publicCounts()).purchases === before.purchases + 3,
  })
  before = await publicCounts()
  await publicCase({
    name: "placeTip", ownerIdentity,
    anonymous: async () => { const result = await products.placeTip({ profileId: foreignProfileId, visitorName: "Anon", visitorEmail: `${prefix}-tip-anon`, amountCents: 500 }) as { id: string }; await tx.payment.update({ where: { id: result.id }, data: { providerPaymentId: `${prefix}-tip-anon` } }) },
    authenticatedForeign: async () => { const result = await products.placeTip({ profileId: foreignProfileId, visitorName: "Foreign", visitorEmail: `${prefix}-tip-foreign`, amountCents: 500 }) as { id: string }; await tx.payment.update({ where: { id: result.id }, data: { providerPaymentId: `${prefix}-tip-foreign` } }) },
    owner: async () => { const result = await products.placeTip({ profileId: ownerProfileId, visitorName: "Owner", visitorEmail: `${prefix}-tip-owner`, amountCents: 500 }) as { id: string }; await tx.payment.update({ where: { id: result.id }, data: { providerPaymentId: `${prefix}-tip-owner` } }) },
    anonymousSucceeded: async () => (await publicCounts()).payments === before.payments + 1,
    foreignSucceeded: async () => (await publicCounts()).payments === before.payments + 2,
    ownerSucceeded: async () => (await publicCounts()).payments === before.payments + 3,
  })
  before = await publicCounts()
  await publicCase({
    name: "addProductReview", ownerIdentity,
    anonymous: () => products.addProductReview({ productId: productIds.foreignPublic, rating: 5, visitorName: `${prefix}-review-anon` }),
    authenticatedForeign: () => products.addProductReview({ productId: productIds.foreignPublic, rating: 4, visitorName: `${prefix}-review-foreign` }),
    owner: () => products.addProductReview({ productId: productIds.ownerPublic, rating: 5, visitorName: `${prefix}-review-owner` }),
    anonymousSucceeded: async () => (await publicCounts()).reviews === before.reviews + 1,
    foreignSucceeded: async () => (await publicCounts()).reviews === before.reviews + 2,
    ownerSucceeded: async () => (await publicCounts()).reviews === before.reviews + 3,
  })
}

async function main(): Promise<void> {
  const target = assertDisposableTarget(process.env.DATABASE_URL)
  if (target !== EXPECTED_DATABASE) throw new Error("DATABASE_URL is not the designated Lane A rehearsal database")

  try {
    await prisma.$transaction(async (tx) => {
      await runSuite(tx)
      throw new RollbackProof("rollback Lane A authorization rehearsal")
    }, { maxWait: 10_000, timeout: 120_000 })
  } catch (error) {
    if (!(error instanceof RollbackProof)) failures.push(`unexpected suite error: ${errorShape(error)}`)
  }

  const restoredRows = await prisma.user.count({ where: { clerkId: { startsWith: prefix } } })
  check("transaction rollback restored zero fixture rows", restoredRows === 0)

  console.log(JSON.stringify({
    result: failures.length === 0 ? "PASS" : "FAIL",
    inverted: invert,
    assertions: checks.length,
    protectedAndPublicActions: coverage,
    rollback: { restoredRows },
    failures,
  }, null, 2))
  if (failures.length > 0) process.exitCode = 1
}

void main().finally(async () => prisma.$disconnect())
