interface EmailOptions {
    to: string
    subject: string
    html: string
    text?: string
}

interface PurchaseEmailData {
    visitorEmail: string
    visitorName?: string
    itemType: 'product' | 'course' | 'event' | 'community'
    itemName: string
    priceCents: number
    profileDisplayName: string
    downloadUrl?: string
    accessUrl?: string
    eventDetails?: {
        startTime: Date
        endTime: Date
        meetingLink?: string
    }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
    console.log('[Email] Would send email:', {
        to: options.to,
        subject: options.subject,
        preview: options.text?.substring(0, 100) || options.html.substring(0, 100)
    })
    return true
}

export async function sendPurchaseConfirmation(data: PurchaseEmailData): Promise<boolean> {
    const { visitorEmail, visitorName, itemType, itemName, priceCents, profileDisplayName, downloadUrl, accessUrl, eventDetails } = data
    
    const formattedPrice = priceCents === 0 ? 'Free' : `$${(priceCents / 100).toFixed(2)}`
    const greeting = visitorName ? `Hi ${visitorName}` : 'Hi there'
    
    let specificContent = ''
    let subjectSuffix = ''
    
    switch (itemType) {
        case 'product':
            subjectSuffix = 'Purchase Confirmed'
            specificContent = downloadUrl 
                ? `<p>You can download your product here: <a href="${downloadUrl}">${downloadUrl}</a></p>`
                : `<p>Your product is ready! You can access it in your purchases.</p>`
            break
        case 'course':
            subjectSuffix = 'Enrollment Confirmed'
            specificContent = accessUrl
                ? `<p>Access your course here: <a href="${accessUrl}">${accessUrl}</a></p>`
                : `<p>Your course access is now active. Log in to start learning!</p>`
            break
        case 'event':
            subjectSuffix = 'Registration Confirmed'
            if (eventDetails) {
                specificContent = `
                    <p><strong>Event Details:</strong></p>
                    <p>Date: ${eventDetails.startTime.toLocaleDateString()} at ${eventDetails.startTime.toLocaleTimeString()}</p>
                    ${eventDetails.meetingLink ? `<p>Join link: <a href="${eventDetails.meetingLink}">${eventDetails.meetingLink}</a></p>` : ''}
                `
            } else {
                specificContent = `<p>You're registered! We'll send you more details as the event approaches.</p>`
            }
            break
        case 'community':
            subjectSuffix = 'Welcome to the Community'
            specificContent = accessUrl
                ? `<p>Join the community here: <a href="${accessUrl}">${accessUrl}</a></p>`
                : `<p>Your community access is now active. Welcome aboard!</p>`
            break
    }
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">${subjectSuffix}!</h1>
                <p style="color: #4a4a4a; font-size: 16px;">${greeting},</p>
                <p style="color: #4a4a4a; font-size: 16px;">Thank you for your purchase from ${profileDisplayName}!</p>
                
                <div style="background-color: #f9f9f9; border-radius: 8px; padding: 16px; margin: 24px 0;">
                    <p style="margin: 0; font-weight: bold; color: #1a1a1a;">${itemName}</p>
                    <p style="margin: 8px 0 0 0; color: #6b6b6b;">${formattedPrice}</p>
                </div>
                
                ${specificContent}
                
                <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
                
                <p style="color: #6b6b6b; font-size: 14px;">
                    If you have any questions, please reply to this email.
                </p>
                
                <p style="color: #6b6b6b; font-size: 12px; margin-top: 24px;">
                    Powered by PersonaLink
                </p>
            </div>
        </body>
        </html>
    `
    
    const text = `
${greeting},

Thank you for your purchase from ${profileDisplayName}!

Item: ${itemName}
Price: ${formattedPrice}

If you have any questions, please reply to this email.

Powered by PersonaLink
    `.trim()
    
    return sendEmail({
        to: visitorEmail,
        subject: `${itemName} - ${subjectSuffix}`,
        html,
        text
    })
}

export async function sendCreatorNotification(data: {
    creatorEmail: string
    creatorName: string
    itemType: 'product' | 'course' | 'event' | 'community' | 'booking'
    itemName: string
    priceCents: number
    customerEmail: string
    customerName?: string
}): Promise<boolean> {
    const { creatorEmail, creatorName, itemType, itemName, priceCents, customerEmail, customerName } = data
    
    const formattedPrice = priceCents === 0 ? 'Free' : `$${(priceCents / 100).toFixed(2)}`
    const customerDisplay = customerName || customerEmail
    
    const actionText = {
        product: 'purchased',
        course: 'enrolled in',
        event: 'registered for',
        community: 'joined',
        booking: 'booked'
    }[itemType]
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">New ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}!</h1>
                <p style="color: #4a4a4a; font-size: 16px;">Hi ${creatorName},</p>
                <p style="color: #4a4a4a; font-size: 16px;">Great news! Someone ${actionText} your offering.</p>
                
                <div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 24px 0;">
                    <p style="margin: 0; font-weight: bold; color: #1a1a1a;">${itemName}</p>
                    <p style="margin: 8px 0 0 0; color: #15803d; font-weight: bold;">${formattedPrice}</p>
                </div>
                
                <p style="color: #4a4a4a; font-size: 16px;">
                    <strong>Customer:</strong> ${customerDisplay}
                </p>
                
                <p style="color: #6b6b6b; font-size: 14px; margin-top: 24px;">
                    View all your orders in your <a href="/dashboard/orders">Dashboard</a>.
                </p>
                
                <p style="color: #6b6b6b; font-size: 12px; margin-top: 24px;">
                    Powered by PersonaLink
                </p>
            </div>
        </body>
        </html>
    `
    
    const text = `
Hi ${creatorName},

Great news! Someone ${actionText} your offering.

Item: ${itemName}
Price: ${formattedPrice}
Customer: ${customerDisplay}

View all your orders in your Dashboard.

Powered by PersonaLink
    `.trim()
    
    return sendEmail({
        to: creatorEmail,
        subject: `New ${itemType}! ${customerDisplay} ${actionText} ${itemName}`,
        html,
        text
    })
}
