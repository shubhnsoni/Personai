import { marketingBusiness } from "@/lib/marketing-business"

export type PolicyDocument = {
    slug: string
    title: string
    kicker: string
    description: string
    updatedOn: string
    draft: boolean
    relatedLinks?: { label: string; href: string }[]
    sections: {
        id: string
        title: string
        paragraphs?: string[]
        bullets?: string[]
        fields?: { label: string; value: string }[]
    }[]
}

const status = { updatedOn: "8 September 2026", draft: !marketingBusiness.policiesApproved }
const operatorFields = [
    { label: "Legal operator name", value: marketingBusiness.operatorName },
    { label: "Business address", value: marketingBusiness.businessAddress },
    { label: "Support email", value: marketingBusiness.supportEmail },
]
const grievanceFields = [
    { label: "Grievance officer", value: marketingBusiness.grievanceOfficer },
    { label: "Grievance email", value: marketingBusiness.grievanceEmail },
]

export const policyDocuments: Record<
    "privacy" | "terms" | "refundPolicy" | "deliveryPolicy" | "cookiePolicy" | "acceptableUse" | "smsPolicy" | "contact" | "about",
    PolicyDocument
> = {
    privacy: {
        ...status,
        slug: "privacy",
        title: "Privacy policy",
        kicker: "Your information",
        description: "How Introify handles account information, public profiles, visitor activity and business interactions.",
        sections: [
            {
                id: "scope", title: "Who this policy covers",
                paragraphs: ["This draft describes information handled through Introify accounts, public business pages and the tools connected to those pages. A business using Introify may also have its own privacy notice for the services it provides. The legal operator and privacy contact below are awaiting completion."],
                fields: operatorFields,
            },
            {
                id: "information", title: "Information you provide",
                bullets: [
                    "Account and profile details, such as your name, email, sign-in identifier, photo, biography, business information and links.",
                    "Content you add, including product and service listings, images, documents and information selected for an AI assistant.",
                    "Messages, enquiries, booking details and order information. Depending on the form, this can include a name, email, phone number, delivery address, appointment details and payment reference or status.",
                    "Information used to provide purchased content or membership access, including the associated email address and access records.",
                    "Some specialised business forms can request a prescription image, a prescription note or a doctor's name. These can contain health information. Do not submit confidential material unless the business has explained the need and the protection available for that specific service.",
                ],
            },
            {
                id: "activity", title: "Information from using a page",
                paragraphs: ["On pages with analytics, Introify records visitor and session identifiers, page paths, interactions, referral and campaign information, device information, approximate country information when available, and visit timing. Session activity can be updated periodically while a page is open. Server and service providers may also process connection information to serve requests and maintain security.", "Cookies and browser storage support these features, member access and saved checkout details. Analytics cookies stay off until you allow analytics on the cookie policy page or the site-wide prompt."],
            },
            {
                id: "purposes", title: "How the information is used",
                bullets: [
                    "Create and authenticate accounts, publish the content you choose, and operate enabled product features.",
                    "Pass an enquiry, booking or order to the relevant business and maintain the associated records.",
                    "Provide access to content, record payment and fulfilment status, and help investigate support or security issues.",
                    "Show page owners information about visits and interactions with their pages.",
                    "Process prompts and relevant context through an AI provider when an AI feature is configured and used.",
                ],
            },
            {
                id: "sharing", title: "Public content, businesses and service providers",
                paragraphs: ["Published profiles, listings and associated public media are available to visitors and may be indexed or copied by others. Information submitted to a business is available to that business for the relevant interaction. A business is responsible for explaining its own further use of that information.", "Hosting, database, sign-in, email, payment and AI services may process information needed for enabled features. Availability depends on the particular integration being configured. A WhatsApp link opens WhatsApp and may include details you entered; sending the message is a separate action in that service.", "Uploaded files should not be treated as a private document vault. Some uploaded media is served through public URLs. Do not upload passwords, payment credentials or confidential records into public content or general uploads.", "Provider locations and terms can differ, so this draft does not promise that all processing stays in India. The operator must complete its service-provider and international-transfer disclosures before approving this policy. Information may also need to be disclosed where law requires it."],
            },
            {
                id: "retention", title: "Retention and security",
                paragraphs: ["Analytics events can be removed after 180 days as an operational measure. Account, chat, file and backup deletion still await an approved retention schedule and an assigned request owner. Expiry of a cookie or access token does not by itself delete the associated server records.", "Security depends on the feature and the providers involved. No service can promise absolute security. Access restrictions, sensitive uploads, backups, retention and incident procedures must be reviewed before confidential or regulated workflows are offered."],
            },
            {
                id: "choices", title: "Your choices and privacy requests",
                paragraphs: ["Use the editing controls available in your account to update your profile and content. You can clear cookies and browser storage using your browser settings; doing so may sign you out or remove saved form details. It does not remove information already received by a business or stored on the server.", "A verified channel for access, correction, deletion, consent withdrawal and privacy complaints must be completed below before this policy is approved. These processes, identity checks and applicable response periods are still being prepared. This draft does not limit rights available under applicable law.", "Businesses should avoid collecting children's information or sensitive records through general forms. Any service intended for children or requiring guardian consent needs a specific review and appropriate controls before activation."],
                fields: grievanceFields,
            },
            {
                id: "changes", title: "Changes to this policy",
                paragraphs: ["The approved policy should be updated when data practices or enabled services change. Material changes requiring notice or a new choice must be communicated through the appropriate product flow. The date above identifies this draft's latest revision."],
            },
        ],
    },
    terms: {
        ...status,
        updatedOn: "13 September 2026",
        "slug": "terms",
        "title": "Terms and conditions",
        "kicker": "Using Introify",
        "description": "Understand your account, subscriptions, content rights, AI features and responsibilities when using Introify.",
        "relatedLinks": [
            {
                "label": "Refund and cancellation policy",
                "href": "/refund-policy"
            },
            {
                "label": "Privacy policy",
                "href": "/privacy"
            },
            {
                "label": "Plans and pricing",
                "href": "/pricing"
            }
        ],
        "sections": [
            {
                "id": "operator",
                "title": "The service and its operator",
                "paragraphs": [
                    "Introify is an online software service for creating public pages, presenting work and business information, and using enabled tools for enquiries, listings, bookings, digital content and AI conversations. Features depend on your plan and the services configured for your account.",
                    "These terms cover Introify's platform. Purchases from businesses using Introify pages also have the relevant seller's purchase terms. Introify is the product name. The operator details and final commercial terms below are awaiting completion; paid checkout must remain unavailable until these details and applicable purchase terms are complete."
                ],
                "fields": [...operatorFields, { label: "Razorpay merchant ID", value: marketingBusiness.razorpayMerchantId }]
            },
            {
                "id": "accounts",
                "title": "Accounts and team access",
                "bullets": [
                    "Use accurate information and manage only pages you are authorised to represent. You must have legal capacity to enter an agreement and authority to act for any business you represent.",
                    "Keep sign-in credentials and access links secure. Give team members only the access they need and remove access when it is no longer required.",
                    "A billing account may cover multiple businesses according to its plan. Allowances are shared across that account; adding a business does not create a fresh allowance.",
                    "Follow the acceptable use policy and applicable law. Do not impersonate others, publish unlawful content or bypass permissions, usage limits or payment controls."
                ]
            },
            {
                "id": "subscriptions",
                "title": "Plans, billing and renewals",
                "paragraphs": [
                    "The pricing page describes current plans. Before paying, review the amount, currency, taxes, billing interval and recurring payment terms shown in checkout. An annual plan is charged for the year; a displayed monthly equivalent is not a monthly instalment.",
                    "Where recurring billing is enabled, subscriptions renew according to the interval you authorise until renewal is turned off. The billing account owner or an authorised billing administrator can manage the subscription in Dashboard → Billing. Not using the service, closing a browser or removing an app shortcut does not cancel a subscription.",
                    "Review the effective date and any charge or credit shown before confirming a plan change. A cancelled or failed checkout does not activate a paid plan. Access and allowances follow confirmed payment and subscription status, rather than a payment attempt or screenshot."
                ]
            },
            {
                "id": "usage",
                "title": "AI credits, generations and add-ons",
                "paragraphs": [
                    "AI credits and photoreal 3D generations are separate allowances. AI usage varies by model. Included monthly allowances reset without rollover; annual billing does not release the whole year’s allowance at once. A free trial generation, where available and eligible, is a one-time trial rather than a recurring monthly grant.",
                    "Add-on packs, where offered, are separate one-time purchases and do not create an automatic top-up. Review the validity and paid-plan requirements shown for the pack. Units are service allowances, not a cash balance or a payment account. Refund questions are governed separately by the refund policy and applicable rights.",
                    "Features marked as planned, unavailable or awaiting activation are not immediately available benefits. Check the current feature availability before purchasing; do not rely solely on a future feature."
                ]
            },
            {
                "id": "content",
                "title": "Your content and intellectual property",
                "paragraphs": [
                    "You retain your rights in the content you supply. You must have the necessary rights and permissions to upload it. You authorise Introify and its service providers to host, process, reproduce and display that content as needed to provide the features you use. This does not transfer ownership to Introify.",
                    "Published pages and selected media are public and may be indexed or copied by others. Do not put private credentials, confidential records or information you are not authorised to share in public content. Keep your own copies of important material. Data handling and deletion are described in the privacy policy.",
                    "Page owners are responsible for their identity, claims, licences, prices, availability and customer disclosures. A listing on Introify is not a certification or endorsement. Introify’s software, name and branding remain subject to their owners’ rights."
                ]
            },
            {
                "id": "transactions",
                "title": "Purchases from businesses on Introify",
                "paragraphs": [
                    "Before purchasing a product, appointment, course, event or other offer, check the seller’s identity, total price, currency, taxes, fulfilment details and cancellation terms. The seller is responsible for the offer and its fulfilment, subject to applicable law.",
                    "Payment options depend on the business and the enabled integration. A UPI QR code or external payment link may send funds directly to the seller. An order request, payment screenshot or WhatsApp message alone is not proof of confirmed payment, acceptance or delivery.",
                    "The seller’s terms do not replace Introify’s responsibilities for its own platform services. Purchases from Introify and purchases from a page owner are separate transactions."
                ]
            },
            {
                "id": "ai",
                "title": "AI and third-party services",
                "paragraphs": [
                    "AI answers and generated assets may be inaccurate, incomplete or unsuitable for a particular use. Review them before relying on or publishing them. AI output is not a guarantee of results or a substitute for qualified professional advice.",
                    "Only supply information you are authorised to process. External AI, payment, authentication and messaging providers have their own terms and privacy practices. Availability depends on the enabled service; Introify cannot guarantee an external provider’s performance."
                ]
            },
            {
                "id": "cancellation",
                "title": "Cancellation, account closure and suspension",
                "paragraphs": [
                    "Turning off subscription renewal and requesting a refund are different actions. See the refund and cancellation policy for the available cancellation steps, paid-period access and refund requests. Closing an account is also separate from stopping a payment mandate.",
                    "When a paid subscription ends, plan limits and access can change. Check the billing screen before cancelling, especially when several businesses share one account. Save important material before requesting account closure; do not assume cancellation automatically deletes stored information.",
                    "Access or content may be restricted to address unlawful activity, security threats, non-payment, abuse or a valid legal requirement. Where appropriate, the operator must provide notice and a route to seek review. Statutory rights and refund remedies are not removed by an account restriction."
                ]
            },
            {
                "id": "availability",
                "title": "Service availability and responsibility",
                "paragraphs": [
                    "The service may be interrupted for maintenance, updates or circumstances outside reasonable control. No uptime, business revenue, conversion or AI accuracy guarantee is made by these terms.",
                    "Use reasonable care when publishing content and making decisions based on it. Nothing here excludes liability or remedies that cannot legally be excluded, including responsibility for Introify’s own services. Any additional commercial liability provisions require review before these terms are approved."
                ]
            },
            {
                "id": "changes",
                "title": "Changes and applicable purchase terms",
                "paragraphs": [
                    "The updated date identifies the latest revision. Material changes should be communicated before they apply where required. Changes must not retrospectively remove rights attached to an earlier purchase. Review the terms shown for your purchase and keep a copy of the receipt.",
                    "Read these terms together with the privacy, acceptable use, refund and delivery policies. A final policy must state any applicable governing law and dispute arrangements without restricting non-waivable consumer rights."
                ]
            },
            {
                "id": "rights",
                "title": "Contact and dispute resolution",
                "paragraphs": [
                    "For a platform issue, provide the account or business page URL, a transaction reference if relevant, and a short description through the published Introify support channel. For an order from a page owner, contact that seller first using its disclosed details.",
                    "Public contact and jurisdiction details below remain pending. This does not remove any right to contact a payment provider, raise a dispute or use remedies available under applicable law. Never send passwords, OTPs, card security codes or UPI PINs in a support request."
                ],
                "fields": [...grievanceFields, { label: "Governing law and jurisdiction", value: marketingBusiness.jurisdiction }]
            }
        ]
    },
    refundPolicy: {
        ...status,
        updatedOn: "13 September 2026",
        "slug": "refund-policy",
        "title": "Refund and cancellation policy",
        "kicker": "Clear purchase decisions",
        "description": "How to stop a renewal, report a billing problem and request a refund for Introify or a purchase from a business page.",
        "relatedLinks": [
            {
                "label": "Terms and conditions",
                "href": "/terms"
            },
            {
                "label": "Contact details",
                "href": "/contact"
            },
            {
                "label": "Delivery policy",
                "href": "/delivery-policy"
            }
        ],
        "sections": [
            {
                "id": "scope",
                "title": "Which purchase does this policy cover?",
                "paragraphs": [
                    "Introify subscriptions and add-on credits are purchases of online software services. A product, booking, course, event or other offer sold by an independent business on an Introify page is a separate purchase from that seller. Check your receipt to identify whom you paid.",
                    "This policy explains those separate responsibilities. It does not replace a seller’s disclosed terms or rights available under applicable law."
                ]
            },
            {
                "id": "status",
                "title": "Refund eligibility and timelines",
                "paragraphs": [
                    "The operator has not yet approved a refund request window, processing period or change-of-mind policy for Introify’s paid services. These values remain intentionally blank. They must be completed and disclosed before a new paid service is offered. This page is not a completed payment-gateway submission while those details are missing.",
                    "Blank fields do not mean all sales are final. Remedies required by law, and any terms already disclosed for a completed purchase, continue to apply. No unapproved deadline on this page limits those rights."
                ],
                "fields": [{ label: "Refund request window", value: marketingBusiness.refundWindow }, { label: "Refund processing time", value: marketingBusiness.refundProcessingTime }, { label: "Refund support email", value: marketingBusiness.supportEmail }]
            },
            {
                "id": "cancel",
                "title": "How to turn off subscription renewal",
                "paragraphs": [
                    "Where a recurring Introify subscription is active, sign in, open Dashboard → Billing, and select the correct billing account. The owner or an authorised billing administrator can choose “Turn off renewal”. Check that the billing screen confirms the change and shows the end of the paid period.",
                    "A confirmed cancellation stops the next renewal. Confirmed paid benefits continue until the end of the paid period shown in Billing, subject to any separate lawful account restriction. The change affects all businesses sharing that billing account.",
                    "Cancellation does not automatically refund an earlier payment or delete your account. Not using Introify or deleting a shortcut does not cancel renewal. If the control is unavailable or does not confirm success, use the published support channel with the account and subscription reference. Do not assume the renewal has stopped."
                ]
            },
            {
                "id": "requests",
                "title": "What to include in a refund request",
                "bullets": [
                    "Identify whether the payment was for Introify or for an independent seller. Use the published contact details for that recipient.",
                    "Include your account email or business page URL, invoice or order number, payment reference, payment date, amount and currency.",
                    "Explain the issue: for example, a duplicate charge, incorrect amount, access not delivered, a cancellation problem or an unauthorised payment.",
                    "For a service issue, describe what you expected, what happened and any troubleshooting already attempted. Share only relevant evidence and remove unnecessary personal information.",
                    "Never send an OTP, UPI PIN, password, complete card number or card security code. A refund request does not require these secrets."
                ]
            },
            {
                "id": "billing-issues",
                "title": "Duplicate, failed or disputed payments",
                "paragraphs": [
                    "Report a suspected duplicate charge or incorrect amount with both payment references where available. An apparently unsuccessful payment may still be pending or later confirmed, so check the payment status before retrying.",
                    "A failed-payment reversal by a bank or payment provider is different from an approved merchant refund. Contact the relevant payment provider about a pending debit and retain its reference. For a suspected unauthorised payment, contact your bank or payment provider promptly as well as the recipient; this policy does not restrict your dispute rights."
                ]
            },
            {
                "id": "subscriptions",
                "title": "Renewals, annual plans and partial use",
                "paragraphs": [
                    "Turning off an annual subscription’s renewal stops the following annual charge; it does not convert the existing annual payment into monthly instalments. Cancellation alone does not decide whether an earlier charge is refundable.",
                    "Refund eligibility for first purchases, renewals, plan changes and partial use must be stated in the approved purchase terms. Introify has not yet approved a blanket no-refund rule or a prorated refund formula. A request must be considered against the disclosed terms, the facts and applicable rights."
                ]
            },
            {
                "id": "credits",
                "title": "AI credits, 3D generations and digital access",
                "paragraphs": [
                    "Add-on packs are separate from subscription charges. Explain whether a request relates to unused purchased units, a usage deduction, a failed generation or digital access that was not delivered. Include the relevant job, invoice or purchase reference if available.",
                    "Restoring a deducted service credit and returning money to a payment method are different remedies. A free trial or included allowance is not itself a separate paid purchase. Availability, prior use and service delivery may be relevant to a request, but they do not automatically remove statutory remedies.",
                    "Introify’s own software service does not involve shipping a physical item. There is no physical return address for an Introify subscription. Physical goods purchased from a page owner follow that seller’s return and fulfilment process."
                ]
            },
            {
                "id": "processing",
                "title": "After a refund is approved",
                "paragraphs": [
                    "An approval and the arrival of funds are separate stages. The operator must communicate the approved amount, relevant payment reference, refund destination and expected processing period. Refunds should be routed through the original payment method where supported; never provide a PIN or OTP to receive one.",
                    "Bank and payment-provider processing can affect when a refund appears. If it does not arrive within the communicated period, follow up with the refund reference so the recipient or payment provider can trace it. The published processing commitment above remains pending approval."
                ]
            },
            {
                "id": "merchants",
                "title": "Purchases from independent businesses",
                "paragraphs": [
                    "For a merchant product, booking, course or event, review the seller’s cancellation, rescheduling, return, non-delivery and refund terms before paying. Contact the seller shown on the listing or receipt with the order and transaction references.",
                    "A UPI QR code or external link may pay the seller directly. Introify cannot promise an automatic reversal of funds it did not receive. A seller’s policy cannot replace Introify’s responsibilities for its own services or waive consumer protections.",
                    "If you cannot identify or reach the seller, use the published platform contact details to report the affected page. That report is separate from a payment dispute with your payment provider."
                ]
            },
            {
                "id": "protections",
                "title": "Your rights and policy updates",
                "paragraphs": [
                    "Nothing in this policy excludes non-waivable consumer protections or prevents a lawful payment dispute. Any approved refund rules must be clear before payment and must not retrospectively remove rights from an earlier purchase.",
                    "The date above identifies this revision. The operator, support contact, refund eligibility and processing deadlines must be completed before this draft is approved for paid-service activation."
                ],
                "fields": [...operatorFields, { label: "Razorpay merchant ID", value: marketingBusiness.razorpayMerchantId }]
            }
        ]
    },
    deliveryPolicy: {
        ...status,
        slug: "delivery-policy",
        title: "Delivery & fulfilment",
        kicker: "What happens next",
        description: "Digital access, booking confirmations and delivery responsibilities for offers presented through Introify.",
        sections: [
            {
                id: "digital", title: "Introify is delivered online",
                paragraphs: ["Introify's software is accessed through a web browser. An Introify software account does not involve shipping a physical product. Access depends on the features enabled for the account and completion of any required sign-in or activation steps.", "This draft does not set an activation deadline, service-level commitment or paid-plan delivery promise. These details must be included in the relevant offer before it is sold."],
            },
            {
                id: "purchases", title: "Digital products and member access",
                paragraphs: ["Where a business offers digital content, the listing should describe the format, access conditions, compatibility requirements and duration. Access may be provided through a library, a download link or the business's own service after the required confirmation.", "A generated confirmation or attempted email is not a guarantee that a message was delivered. Delivery channels and recovery procedures must be verified before relying on emailed access links for a paid offer."],
            },
            {
                id: "bookings", title: "Appointments, events and services",
                paragraphs: ["The business providing a service must state the date or scheduling process, location or meeting method, availability, rescheduling rules and any preparation required. A submitted request should be treated according to the confirmation shown by that business.", "SMS, WhatsApp and email reminders should only be expected when the particular channel has been activated and its delivery has been confirmed. A WhatsApp contact button opens a conversation; it does not by itself confirm a booking."],
            },
            {
                id: "physical", title: "Physical goods offered by businesses",
                paragraphs: ["A merchant selling physical goods is responsible for disclosing its service area, shipping charges, dispatch and delivery estimates, tracking arrangements, and the process for lost, damaged or delayed items. Check the merchant's terms before ordering.", "Introify does not publish a universal shipping rate, courier partner or delivery promise for every business using its pages."],
            },
            {
                id: "help", title: "Missing access or an unfulfilled order",
                paragraphs: ["Keep the confirmation and transaction reference. For a merchant offer, use the contact details on that merchant's page. For Introify account access, the platform support details below must be completed before this policy is approved. Cancellation and refund questions are covered separately in the refund policy."],
                fields: [{ label: "Platform support email", value: marketingBusiness.supportEmail }],
            },
        ],
    },
    cookiePolicy: {
        ...status,
        slug: "cookie-policy",
        title: "Cookies & browser storage",
        kicker: "What your browser remembers",
        description: "The cookies and local storage used for page analytics, member access and saved checkout details.",
        sections: [
            {
                id: "overview", title: "Storage depends on the feature you use",
                paragraphs: ["Cookies are small values sent with browser requests. Local storage stays in your browser and can be read by the site's scripts. Not every item below is created on every page. Sign-in and other configured external services may also use their own storage.", "The inventory below reflects the current application. A cookie's expiry is separate from retention of related information in the database. Returning to a page can refresh an expiry."],
            },
            {
                id: "analytics", title: "Page analytics and referrals",
                bullets: ["pl_vid: a visitor identifier used on tracked profile pages. The cookie is set for 180 days. A local-storage copy has no automatic expiry, so clearing only the cookie may allow the identifier to be restored.", "pl_ref: a referral value stored in a cookie for 30 days when a referral parameter is present.", "Tracked profile pages send visit and interaction information to Introify. A session probe can update visit timing every 15 seconds while the page is open."],
                paragraphs: ["Analytics on participating profile pages stays off until a visitor allows it in the cookie preference control. Essential sign-in and interface storage still works. This draft still requires operator review of notice wording, retention and provider terms before the policy is approved."],
            },
            {
                id: "access", title: "Access and form convenience",
                bullets: ["pl_member: an HTTP-only cookie used for member-library access, with a 30-day lifetime. It is separate from account sign-in provided by a configured authentication service.", "pl_buyer: a local-storage record of checkout name and email that expires after 30 days. Legacy pl_buyer_email and pl_buyer_name values are no longer restored.", "Other feature-specific browser values may support conversations and interface preferences. The operator must complete a deployment-level inventory, including configured providers, before approving this policy."],
            },
            {
                id: "control", title: "Managing browser storage",
                paragraphs: ["Use the cookie preference control on this page, or your browser's site-data controls, to inspect or clear cookies and local storage for Introify. On a shared device, clear saved checkout information and sign out after use. Blocking storage may affect sign-in, member access, saved fields or other features.", "Deleting browser storage does not delete order, account or analytics records already held on a server. A verified privacy-request channel is still pending owner assignment in the privacy policy."],
            },
        ],
    },
    acceptableUse: {
        ...status,
        slug: "acceptable-use",
        title: "Acceptable use",
        kicker: "A trustworthy place to do business",
        description: "Standards for the content, offers and interactions people bring to Introify.",
        sections: [
            {
                id: "honest", title: "Represent yourself and your work honestly",
                paragraphs: ["Use Introify for lawful activity that you are authorised to carry out. Keep your identity, qualifications, product descriptions and business claims accurate. Do not impersonate another person or suggest that Introify has verified a licence, endorsement or outcome when it has not."],
            },
            {
                id: "prohibited", title: "Content and conduct that are not permitted",
                bullets: ["Fraud, phishing, deceptive payment requests, stolen goods or offers that are unlawful in the location where they are provided.", "Unlicensed regulated services or goods, unlawful medical claims, or attempts to evade a payment or messaging provider's restrictions.", "Malware, credential theft, unauthorised access, security exploitation or activity that disrupts the service.", "Harassment, threats, exploitation, unlawful discrimination, or sexual content involving minors.", "Publishing another person's confidential information, private images or intellectual property without the necessary authority.", "Spam, purchased contact lists, unsolicited marketing, or attempts to bypass a recipient's communication preferences.", "Using AI or automation to impersonate people, manufacture misleading claims or carry out prohibited activity."],
            },
            {
                id: "business", title: "Responsibilities of page owners",
                paragraphs: ["Only request information needed for a clearly explained purpose. Give customers accurate prices, fulfilment terms, support information and any legally required disclosures. Obtain required permissions before contacting people or sharing their information with another service.", "Do not use public uploads or general message fields as a repository for passwords, payment secrets or confidential medical records. Regulated or sensitive workflows need appropriate approval and technical protections before use."],
            },
            {
                id: "reports", title: "Reports and enforcement",
                paragraphs: ["Introify may need to review, restrict or remove activity that violates these standards or creates a security or legal risk. A reporting and review process, including urgent safety reports, must be operational before this draft is approved. The designated contact fields remain pending."],
                fields: grievanceFields,
            },
        ],
    },
    smsPolicy: {
        ...status,
        slug: "sms-policy",
        title: "SMS & communication policy",
        kicker: "Messages with a clear purpose",
        description: "The proposed safeguards and activation requirements for text messages connected to Introify.",
        sections: [
            {
                id: "status", title: "SMS activation is pending",
                paragraphs: ["This page does not enrol you in SMS messages or announce an active SMS service. The current appointment reminder integration does not send SMS. A provider, approved sender identity and working consent and withdrawal processes must be configured before messages are enabled.", "Opening a page, entering a phone number for an order or booking, or using a WhatsApp button is not presented here as consent to promotional SMS."],
                fields: [{ label: "SMS sender ID / header", value: marketingBusiness.smsSenderId }, { label: "Messaging support email", value: marketingBusiness.supportEmail }],
            },
            {
                id: "purpose", title: "Explain each message before collecting consent",
                paragraphs: ["Any future messaging flow must identify the business sending the message and explain its purpose. Service updates associated with a requested transaction and promotional messages require the appropriate separate classification, preferences and permissions.", "A promotional opt-in must be a clear, voluntary action. The final flow must disclose the expected type and frequency of messages, keep a record of the choice, and avoid making an unrelated purchase conditional on marketing consent."],
            },
            {
                id: "withdrawal", title: "A working way to change your choice",
                paragraphs: ["A tested withdrawal route must be disclosed before an SMS programme launches. Introify does not currently offer a working SMS preference centre or a reply-STOP handler. Some sender types cannot receive replies, so the final instructions must match the selected channel.", "The messaging process must honour applicable recipient preferences and withdrawn consent. A withdrawal should not be silently reversed by a later booking or account update."],
            },
            {
                id: "india", title: "Sending messages in India",
                paragraphs: ["Commercial SMS must be set up under the applicable telecom registration and template processes. The operator and its messaging provider must validate the principal entity, sender header, message category, registered templates and delivery chain before activation.", "Template variables, links and callback details must follow the applicable provider and telecom validation requirements. Publishing this policy does not complete DLT registration or approve a message template."],
            },
            {
                id: "safety", title: "Message safety and delivery",
                paragraphs: ["Do not share an OTP, password, card security code or UPI PIN in response to a support or refund message. Check the identity of the business and the destination of any link before acting.", "Delivery depends on the network, provider, recipient preferences and the accuracy of the phone number. A reminder cannot replace the booking or order information itself. WhatsApp and email are separate channels with their own activation and privacy requirements."],
            },
        ],
    },
    contact: {
        ...status,
        slug: "contact",
        title: "Contact Introify",
        kicker: "The right place for your question",
        description: "Platform support and business contact details for Introify, currently awaiting completion.",
        sections: [
            {
                id: "details", title: "Platform contact details",
                paragraphs: ["These public business details are being finalised. The fields are intentionally blank and do not yet provide an active platform support channel."],
                fields: [...operatorFields, { label: "Support phone", value: marketingBusiness.supportPhone }],
            },
            {
                id: "orders", title: "A question about a business on Introify",
                paragraphs: ["For an order, appointment, product or service offered by a page owner, use the contact information that business publishes on its page. Include the relevant order or booking reference so the business can locate the interaction.", "Introify platform issues include account access, the operation of a page and concerns about misuse of the platform. The operator must activate and verify the platform contact details above before completing this page."],
            },
            {
                id: "privacy", title: "Privacy and grievance contact",
                paragraphs: ["The responsible person and monitored contact channel are awaiting confirmation. The final process must support privacy requests, consumer complaints and reports of harmful or unlawful content, with the applicable response and escalation arrangements."],
                fields: grievanceFields,
            },
            {
                id: "safe", title: "Share only what is needed",
                paragraphs: ["A useful support enquiry includes the affected page URL, a reference number if available and a short description of the issue. Do not send passwords, OTPs, UPI PINs, card security codes or confidential medical records in an ordinary support message."],
            },
        ],
    },
    about: {
        ...status,
        slug: "about",
        title: "About Introify",
        kicker: "Your work, easier to discover",
        description: "Introify brings a profile, services, products and next steps together in one place.",
        sections: [
            {
                id: "idea", title: "One place to introduce your work",
                paragraphs: ["People should be able to understand what you do and know how to take the next step. Introify brings a public profile, useful links and business information together in a page you can share.", "Depending on the tools you enable, that page can help visitors explore services and products, send an enquiry, request a booking or access content. A dashboard helps page owners organise the information and interactions behind the page."],
            },
            {
                id: "audience", title: "For people and the businesses they build",
                paragraphs: ["Introify is designed for independent professionals, creators and business owners who want a clearer online introduction. The content and offers come from the person or business behind each page.", "Page owners remain responsible for the accuracy of their claims, the permissions they need and the promises they make to customers. Available integrations and features can vary; a product example is not a guarantee of business results."],
            },
            {
                id: "operator", title: "Business information",
                paragraphs: ["Introify is the product name. The legal operator and public business details below are awaiting confirmation. No company registration, professional accreditation or tax registration is implied by this draft."],
                fields: [...operatorFields, { label: "Registration number, if applicable", value: marketingBusiness.registrationNumber }, { label: "GST number, if applicable", value: marketingBusiness.gstNumber }],
            },
        ],
    },
}
