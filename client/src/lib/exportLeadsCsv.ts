import type { Lead } from '@/types/index.ts'

// Quote every value and stop spreadsheets from treating cell text as a formula
const toCell = (value: string | number | null) => {
    let text = value === null ? '' : String(value)
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
}

export default function exportLeadsCsv(leads: Lead[]) {
    const header = ['Company', 'Website', 'Domain', 'Industry', 'Employees', 'Location', 'Country', 'Contacts', 'Emails', 'Phone', 'Description', 'Mail server', 'Email provider', 'Score', 'Fit', 'Score reasons', 'Source', 'Source URL']
    const rows = leads.map((lead) => [
        lead.name,
        lead.website,
        lead.domain,
        lead.industry,
        lead.employee_count,
        lead.address,
        lead.country,
        // "Jane Smith (CEO) <jane@acme.com> +1 555 0100; John Doe (Founder)"
        lead.contacts.map((contact) => `${contact.name} (${contact.title})${contact.email ? ` <${contact.email}>` : ''}${contact.phone ? ` ${contact.phone}` : ''}`).join('; '),
        [...lead.contacts.flatMap((contact) => contact.email ?? []), ...lead.company_emails.map((item) => item.email)].join('; '),
        lead.phone,
        lead.description,
        lead.mx_status,
        lead.email_provider,
        lead.score,
        lead.fit_label,
        lead.score_reasons.join('; '),
        lead.source_name,
        lead.source_url,
    ])

    // The BOM makes Excel read the file as UTF-8
    const csv = '﻿' + [header, ...rows].map((row) => row.map(toCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))

    const link = document.createElement('a')
    link.href = url
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
}
