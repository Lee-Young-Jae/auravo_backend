"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTTL = void 0;
// TTL parsing helper (e.g., '15m', '7d')
const parseTTL = (ttl) => {
    const match = /^([0-9]+)([smhd])$/.exec(ttl);
    if (!match)
        throw new Error(`Invalid TTL format: ${ttl}`);
    const value = parseInt(match[1], 10);
    switch (match[2]) {
        case "s":
            return value * 1000;
        case "m":
            return value * 60 * 1000;
        case "h":
            return value * 60 * 60 * 1000;
        case "d":
            return value * 24 * 60 * 60 * 1000;
        default:
            throw new Error(`Unknown TTL unit: ${match[2]}`);
    }
};
exports.parseTTL = parseTTL;
