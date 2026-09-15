// Public operator identity for marketing/legal pages.
// Keep `policiesApproved` false until the founder confirms registered entity,
// address, refund windows, and payment-gateway terms. That flag also gates
// paid checkout — do not flip it to open billing from placeholders.
// Keep credentials and private contact information out of this file.
const founderPending = "Pending founder confirmation"

export const marketingBusiness = {
    brandName: "Introify",
    siteUrl: "https://introify.com",
    razorpayMerchantId: "IlvCZ0jqGV3pyu",
    operatorName: "Introify",
    supportEmail: (process.env.INTROIFY_SUPPORT_EMAIL || "hello@introify.com").trim(),
    businessAddress: `${founderPending} — operating from India`,
    supportPhone: founderPending,
    refundWindow: "",
    refundProcessingTime: "",
    grievanceOfficer: "Founder, Introify",
    grievanceEmail: (process.env.INTROIFY_SUPPORT_EMAIL || "hello@introify.com").trim(),
    jurisdiction: `${founderPending} (intended: India)`,
    registrationNumber: founderPending,
    gstNumber: founderPending,
    smsSenderId: founderPending,
    policiesApproved: false,
}
