"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireOwnedProfile, unwrapOwnershipResult } from "@/lib/security"
import { cityFromProfile, goldBoardFromConfig, writeGoldBoard, type GoldBoard, type GoldQuote } from "@/lib/metal/board"
import { fetchCityGoldRates } from "@/lib/metal/fetch-city-rate"
import { boardMoved, isJewelryKit, isJewelryWholesale, rupeesPerGramToPaisePer10g, ticketPaise, type GoldRates } from "@/lib/metal/math"
import { parseProductMetal } from "@/lib/metal/product"

function requireJewelry(role: string | null | undefined) {
    if (!isJewelryKit(role)) throw new Error("Gold board is for jewellery kits")
}

async function saveConfig(profileId: string, config: string) {
    await prisma.profile.update({ where: { id: profileId }, data: { personalityConfig: config } })
}

async function retagMetalPrices(profileId: string, rates: GoldRates, role?: string | null) {
    if (isJewelryWholesale(role)) return
    const products = await prisma.digitalProduct.findMany({
        where: { profileId },
        select: { id: true, variantsJson: true },
    })
    for (const product of products) {
        const metal = parseProductMetal(product.variantsJson)
        if (!metal) continue
        const priceCents = ticketPaise(metal, rates)
        await prisma.digitalProduct.update({
            where: { id: product.id },
            data: { priceCents, currency: "INR" },
        })
    }
}

export async function previewCityGoldRate(profileId: string, city?: string) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    requireJewelry(profile.roleTemplate)
    const place = cityFromProfile(profile.personalityConfig, city)
    const quote = await fetchCityGoldRates(place.citySlug === "india" ? "India" : place.city)
    const board = goldBoardFromConfig(profile.personalityConfig)
    const next: GoldBoard = board
        ? { ...board, quote, lastCheckedAt: quote.fetchedAt }
        : {
              city: quote.city,
              citySlug: quote.citySlug,
              asOf: quote.fetchedAt,
              source: "city-feed",
              k24PaisePer10g: quote.k24PaisePer10g,
              k22PaisePer10g: quote.k22PaisePer10g,
              k18PaisePer10g: quote.k18PaisePer10g,
              quote,
              lastCheckedAt: quote.fetchedAt,
          }
    await saveConfig(profile.id, writeGoldBoard(profile.personalityConfig, next))
    if (!board) await retagMetalPrices(profile.id, quote, profile.roleTemplate)
    return {
        quote,
        moved: board ? boardMoved(board, quote) : false,
        hasBoard: Boolean(board),
    }
}

export async function applyGoldQuote(profileId: string) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    requireJewelry(profile.roleTemplate)
    const board = goldBoardFromConfig(profile.personalityConfig)
    const quote = board?.quote
    if (!quote) throw new Error("Fetch today's city rate first")
    const next: GoldBoard = {
        city: quote.city,
        citySlug: quote.citySlug,
        asOf: new Date().toISOString(),
        source: "city-feed",
        k24PaisePer10g: quote.k24PaisePer10g,
        k22PaisePer10g: quote.k22PaisePer10g,
        k18PaisePer10g: quote.k18PaisePer10g,
        quote,
        lastCheckedAt: quote.fetchedAt,
    }
    await saveConfig(profile.id, writeGoldBoard(profile.personalityConfig, next))
    await retagMetalPrices(profile.id, next, profile.roleTemplate)
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/products")
    revalidatePath(`/${profile.slug}/shop`)
    return next
}

export async function saveManualGoldBoard(
    profileId: string,
    input: { city: string; k24RupeesPerGram: number; k22RupeesPerGram: number; k18RupeesPerGram: number },
) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    requireJewelry(profile.roleTemplate)
    const place = cityFromProfile(profile.personalityConfig, input.city)
    const rates = {
        k24PaisePer10g: rupeesPerGramToPaisePer10g(input.k24RupeesPerGram),
        k22PaisePer10g: rupeesPerGramToPaisePer10g(input.k22RupeesPerGram),
        k18PaisePer10g: rupeesPerGramToPaisePer10g(input.k18RupeesPerGram),
    }
    if (rates.k24PaisePer10g <= 0 || rates.k22PaisePer10g <= 0 || rates.k18PaisePer10g <= 0) {
        throw new Error("Enter 24K, 22K, and 18K rupees per gram")
    }
    const next: GoldBoard = {
        ...rates,
        city: place.city,
        citySlug: place.citySlug,
        asOf: new Date().toISOString(),
        source: "manual",
        quote: goldBoardFromConfig(profile.personalityConfig)?.quote ?? null,
        lastCheckedAt: goldBoardFromConfig(profile.personalityConfig)?.lastCheckedAt ?? null,
    }
    await saveConfig(profile.id, writeGoldBoard(profile.personalityConfig, next))
    await retagMetalPrices(profile.id, next, profile.roleTemplate)
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/products")
    revalidatePath(`/${profile.slug}/shop`)
    return next
}

export async function checkGoldQuoteIfStale(profileId: string): Promise<{ quote: GoldQuote; moved: boolean } | null> {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    if (!isJewelryKit(profile.roleTemplate)) return null
    const board = goldBoardFromConfig(profile.personalityConfig)
    const place = cityFromProfile(profile.personalityConfig)
    const checked = board?.lastCheckedAt ? Date.parse(board.lastCheckedAt) : 0
    if (checked && Date.now() - checked < 60 * 60 * 1000) {
        if (board?.quote && boardMoved(board, board.quote)) return { quote: board.quote, moved: true }
        return null
    }
    try {
        const quote = await fetchCityGoldRates(place.city)
        const next: GoldBoard = board
            ? { ...board, quote, lastCheckedAt: quote.fetchedAt }
            : {
                  city: quote.city,
                  citySlug: quote.citySlug,
                  asOf: quote.fetchedAt,
                  source: "city-feed",
                  k24PaisePer10g: quote.k24PaisePer10g,
                  k22PaisePer10g: quote.k22PaisePer10g,
                  k18PaisePer10g: quote.k18PaisePer10g,
                  quote,
                  lastCheckedAt: quote.fetchedAt,
              }
        await saveConfig(profile.id, writeGoldBoard(profile.personalityConfig, next))
        if (!board) await retagMetalPrices(profile.id, quote, profile.roleTemplate)
        return { quote, moved: board ? boardMoved(board, quote) : false }
    } catch {
        return null
    }
}
