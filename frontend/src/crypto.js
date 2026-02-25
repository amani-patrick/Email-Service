/**
 * Zero-Knowledge Crypto Utility using WebCrypto API
 */

export const generateKeyPair = async () => {
    return await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );
};

export const exportKey = async (key) => {
    const exported = await window.crypto.subtle.exportKey("jwk", key);
    return JSON.stringify(exported);
};

export const importKey = async (jwkString, type) => {
    const jwk = JSON.parse(jwkString);
    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        type === "public" ? ["encrypt"] : ["decrypt"]
    );
};

export const encryptMessage = async (publicKey, message) => {
    const encoded = new TextEncoder().encode(message);
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        encoded
    );
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
};

export const decryptMessage = async (privateKey, encryptedBase64) => {
    const encrypted = new Uint8Array(
        atob(encryptedBase64)
            .split("")
            .map((c) => c.charCodeAt(0))
    );
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encrypted
    );
    return new TextDecoder().decode(decrypted);
};

/**
 * File Encryption Helpers (AES-GCM)
 */

export const generateFileKey = async () => {
    return await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
};

export const encryptFile = async (aesKey, fileData) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        fileData
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return combined;
};

export const decryptFile = async (aesKey, combinedData) => {
    const iv = combinedData.slice(0, 12);
    const encrypted = combinedData.slice(12);
    return await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encrypted
    );
};

export const exportFileKey = async (publicKey, aesKey) => {
    const exportedRaw = await window.crypto.subtle.exportKey("raw", aesKey);
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        exportedRaw
    );
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
};

export const importFileKey = async (privateKey, encryptedKeyBase64) => {
    const encrypted = new Uint8Array(
        atob(encryptedKeyBase64)
            .split("")
            .map((c) => c.charCodeAt(0))
    );
    const decryptedRaw = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encrypted
    );
    return await window.crypto.subtle.importKey(
        "raw",
        decryptedRaw,
        "AES-GCM",
        true,
        ["decrypt"]
    );
};

/**
 * Private Key wrapping logic
 */
export const wrapPrivateKey = async (privateKeyJwk, password) => {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password.padEnd(32).slice(0, 32));
    const aesKey = await window.crypto.subtle.importKey(
        "raw",
        passwordData,
        "AES-GCM",
        false,
        ["encrypt"]
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encoder.encode(privateKeyJwk)
    );

    return JSON.stringify({
        iv: btoa(String.fromCharCode(...iv)),
        data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
    });
};

export const unwrapPrivateKey = async (wrappedString, password) => {
    const wrapped = JSON.parse(wrappedString);
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password.padEnd(32).slice(0, 32));
    const aesKey = await window.crypto.subtle.importKey(
        "raw",
        passwordData,
        "AES-GCM",
        false,
        ["decrypt"]
    );

    const iv = new Uint8Array(atob(wrapped.iv).split("").map(c => c.charCodeAt(0)));
    const data = new Uint8Array(atob(wrapped.data).split("").map(c => c.charCodeAt(0)));

    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        data
    );

    return new TextDecoder().decode(decrypted);
};
