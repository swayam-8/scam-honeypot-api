exports.scan = (text) => {
    return {
        upiIds: (text.match(/[a-zA-Z0-9.\-_]+@[a-zA-Z]+/g) || []),
        bankAccounts: (text.match(/\b\d{9,18}\b/g) || []),
        phoneNumbers: (text.match(/(\+91[\-\s]?)?[6789]\d{9}/g) || []),
        phishingLinks: (text.match(/https?:\/\/[^\s]+/g) || []),
        suspiciousKeywords: (text.match(/\b(urgent|block|verify|kyc|suspend|otp)\b/yi) || [])
    };
};

exports.mergeIntel = (oldIntel, newIntel) => {
    // Merge arrays and remove duplicates
    const merge = (a, b) => [...new Set([...a, ...b])];
    return {
        upiIds: merge(oldIntel.upiIds, newIntel.upiIds),
        bankAccounts: merge(oldIntel.bankAccounts, newIntel.bankAccounts),
        phoneNumbers: merge(oldIntel.phoneNumbers, newIntel.phoneNumbers),
        phishingLinks: merge(oldIntel.phishingLinks, newIntel.phishingLinks),
        suspiciousKeywords: merge(oldIntel.suspiciousKeywords, newIntel.suspiciousKeywords),
    };
};