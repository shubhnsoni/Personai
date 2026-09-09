import { marketingBusiness } from "@/lib/marketing-business"

export type PolicyDocument = {
    slug: string
    title: string
    kicker: string
    description: string
    updatedOn: string
    draft: boolean
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
                paragraphs: ["On pages with analytics, Introify records visitor and session identifiers, page paths, interactions, referral and campaign information, device information, approximate country information when available, and visit timing. Session activity can be updated periodically while a page is open. Server and service providers may also process connection information to serve requests and maintain security.", "Cookies and browser storage support these features, member access and saved checkout details. The cookie policy explains the storage currently present. A separate analytics consent control is not yet implemented."],
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
                paragraphs: ["Account, transaction, conversation and uploaded-content retention periods are awaiting an approved retention schedule. Expiry of a cookie or access token does not by itself delete the associated server records. Browser storage without an expiry remains until cleared by you, the browser or the application.", "Security depends on the feature and the providers involved. No service can promise absolute security. Access restrictions, sensitive uploads, backups, retention and incident procedures must be reviewed before confidential or regulated workflows are offered."],
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
        slug: "terms",
        title: "Terms of service",
        kicker: "Using Introify",
        description: "The responsibilities of Introify users, page owners and customers interacting with their businesses.",
        sections: [
            {
                id: "operator", title: "The service and its operator",
                paragraphs: ["Introify provides software for a public profile, business information and enabled tools such as enquiries, listings, bookings and content access. Plan prices and allowances are described on the pricing page. The legal operator details below and the final commercial terms are awaiting approval; paid checkout must remain unavailable until these details and applicable purchase terms are complete."],
                fields: operatorFields,
            },
            {
                id: "accounts", title: "Accounts and authorised use",
                bullets: ["Use accurate information and only create or manage a page for yourself or a business you are authorised to represent.", "Keep sign-in credentials and access links secure. Do not share another person's private information without authority.", "Business account holders must be able to enter a binding agreement for their use of the service. Features for children require a separate review before being offered.", "Follow the acceptable use policy and the laws applicable to your content, business and customers."],
            },
            {
                id: "content", title: "Your content and business page",
                paragraphs: ["You retain your rights in content you supply. You must have the necessary rights to publish it and allow Introify and its service providers to store, process and display it as needed to operate the features you use. Publishing a page makes the selected content available to other people.", "Page owners are responsible for their identity, claims, licences where required, listing accuracy, availability, prices and customer disclosures. A profile's appearance on Introify is not certification of that business or its services."],
            },
            {
                id: "transactions", title: "Listings, bookings and payments",
                paragraphs: ["Check the identity of the seller or service provider and the listing's price, currency, taxes, delivery details and cancellation terms before making a commitment. The business offering the item or service is responsible for fulfilling its stated offer and addressing the transaction, subject to applicable law.", "Available payment options depend on the business and integration. A UPI QR code or payment link may send funds directly to a merchant. An order request, a payment screenshot or a WhatsApp message alone is not proof of confirmed payment, acceptance or delivery.", "If Introify offers a paid service of its own, the applicable price, billing period, renewal terms and refund conditions must be displayed before payment. No price or refund deadline is established by this draft. Introify remains responsible for its own services and any obligations imposed by law."],
            },
            {
                id: "ai", title: "AI and third-party services",
                paragraphs: ["AI features depend on configured providers and the information supplied to them. Outputs may be inaccurate or incomplete. Review them before relying on or publishing them, and obtain qualified advice for decisions that require it.", "External websites, payment services, sign-in providers and messaging applications have their own terms and privacy practices. Introify cannot promise the availability or performance of an external service."],
            },
            {
                id: "availability", title: "Availability and misuse",
                paragraphs: ["Features may change or be unavailable during maintenance or service interruptions. This draft does not provide an uptime, revenue or response-time guarantee.", "Access or content may need to be restricted to address unlawful activity, security threats, abuse or a valid legal requirement. The approved operating process must provide a contact route for affected users and review requests where appropriate."],
            },
            {
                id: "rights", title: "Questions and applicable rights",
                paragraphs: ["Nothing in these draft terms excludes consumer protections or other rights that cannot lawfully be excluded. Commercial liability provisions and dispute arrangements require review once the operator and service model are confirmed."],
                fields: [...grievanceFields, { label: "Governing law and jurisdiction", value: marketingBusiness.jurisdiction }],
            },
        ],
    },
    refundPolicy: {
        ...status,
        slug: "refund-policy",
        title: "Cancellation & refunds",
        kicker: "Clear purchase decisions",
        description: "How cancellation and refund responsibilities relate to Introify services and purchases from page owners.",
        sections: [
            {
                id: "status", title: "Refund terms are being finalised",
                paragraphs: ["The operator has not yet approved a refund request window or processing period for Introify's own paid services. These fields intentionally remain blank. This draft must not be used as a completed refund offer for a new paid service."],
                fields: [{ label: "Refund request window", value: marketingBusiness.refundWindow }, { label: "Refund processing time", value: marketingBusiness.refundProcessingTime }, { label: "Refund support email", value: marketingBusiness.supportEmail }],
            },
            {
                id: "introify", title: "Services purchased from Introify",
                paragraphs: ["Before a paid Introify service is offered, its checkout and approved policy must explain eligibility, how to cancel or request a refund, any exceptions, the treatment of renewals or partial use, and when an approved refund is expected. Those decisions are pending.", "Cancelling a renewal and refunding a payment are different actions. A final policy must explain both where recurring billing is offered. No automatic renewal or cancellation feature is promised by this draft."],
            },
            {
                id: "merchants", title: "Purchases from a page owner",
                paragraphs: ["A product, booking, course, event or other offer on a business page is subject to that business's disclosed cancellation and refund terms and applicable law. Review those terms and the seller's contact details before paying. A merchant-specific policy does not replace Introify's obligations for its own services.", "For a payment made directly to a merchant through UPI or an external link, the merchant and the payment service handle the relevant payment process. Introify cannot promise an automatic reversal of funds it did not receive."],
            },
            {
                id: "requests", title: "Information for a refund enquiry",
                bullets: ["Keep the order or booking reference, payment reference, transaction date and the name of the seller.", "Explain whether the concern is a duplicate charge, cancellation, non-delivery, incorrect item or another issue.", "Use the verified support channel for the seller or service concerned. Never send an OTP, UPI PIN, card security code or account password to request a refund."],
            },
            {
                id: "protections", title: "Consumer protections",
                paragraphs: ["Blank fields do not mean that all sales are final or that a customer has waived statutory rights. Any approved policy must preserve remedies required by applicable law and distinguish a refund being approved from the payment provider completing it."],
            },
        ],
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
                paragraphs: ["Analytics currently runs on participating profile pages without a separate consent preference control. This draft does not claim that analytics is disabled until consent. The operator must decide and implement the appropriate notice, choice and retention controls before approving this policy."],
            },
            {
                id: "access", title: "Access and form convenience",
                bullets: ["pl_member: an HTTP-only cookie used for member-library access, with a 30-day lifetime. It is separate from account sign-in provided by a configured authentication service.", "pl_buyer_email and pl_buyer_name: local-storage values used to prefill checkout details. They have no automatic expiry in the current implementation.", "Other feature-specific browser values may support conversations and interface preferences. The operator must complete a deployment-level inventory, including configured providers, before approving this policy."],
            },
            {
                id: "control", title: "Managing browser storage",
                paragraphs: ["Use your browser's site-data controls to inspect or clear cookies and local storage for Introify. On a shared device, clear saved checkout information and sign out after use. Blocking storage may affect sign-in, member access, saved fields or other features.", "Deleting browser storage does not delete order, account or analytics records already held on a server. A verified privacy-request channel is still pending in the privacy policy. A dedicated cookie settings panel is not currently offered."],
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
