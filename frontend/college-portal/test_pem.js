const crypto = require('crypto');

const privateKeyRaw = '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCW8IgzlnK4bg3u\\nwCMkqvsgON5gpmAWnAGBJu+7voyEKyqxwuQLjMUVGlB8Pt6PK831DTfXcU9ZLhzD\\ntw9E4Wi82TCINl2CCc2GvTfUF/YqOXNoEoR82dC8Milr/9Kmz0gX+igSv0ufBPJ3\\nRQDrv6o4K0T47LppEyq1EsCcd3c9hVNpojjDONMIghIJVpo5E/T1DyKBTAHK/3ju\\nUIS64jkW+MWwwBPZn7X5kvgpWEAkrUPcjYu0ofmKtPD+HHpIDheLEbAI14guHYFq\\nWD5SuTLR8tS/3FkToMUQTdf1lFksTYMA12948pqbBRcbblDdQyCE42VURR8S9Mie\\nYeVGzJu5AgMBAAECggEAFZ0W29BA2DEGNLh1r9P+BtSt30gjvUkUnBJfxNIZ2/k0\\ncWT3c8HyHL36ZXg5NWYv5VXBt8uFcb89Jjdp69KdRWGSZgbm5+6QbClfO7M8sDou\\n0OnJ5/jmv3QtY0YsO2+2IpzTLTAQW5KBR9vtMFTvQoDLrRt07APvGyO2yhD/VaMv\\n3o6MsstfZiuIPuDIqLI7b8yw4PCOaFrTsRWLQ/HJzeJ0rO8v2RKI1ZGTpC1ccpZQ\\nmaYFQ4w+mfRYHdzgv1AvbJVJIaMumjlCJcvIVvJfCW5BeAyr4po0EIE4f2iQEZG5\\nidMV6ukQMwrA++jJZKbrZsG6qRhLHa67aCua8cbUyQKBgQDVBX322+pCRGJQD7U7\\n/vOqtikzXdk+pbbeRZe8AW6CASz+qKVyCIGhHhOPKYyIGFi3Klehva20UOAMc8GY\\njoUKwGbbL9bm7YAgnYdMbVggrqIZVjRzlMNFfb2OF5gSKOUoT1pBWnbbrNZsYhb2\\n14LFXUSwiieLPApHEEC/aVNppQKBgQC1ZIaXYvlzHNZaJ1JobhGATFffrmxNI5X+\\nU04EoSUamCRIWdJ1Lmo7wSYJ0NW6GHLZ+oYk2DXi0zWby5fK9IcwQr5s8ad2PGdo\\n+3cZBYIUM/KUzfh7ASJAJKKQv4ba/5gd7Y3Tz92iM+UmMrK95IRauiVKHqQOrXg+\\n1VdOqgSFhQKBgFCpc7k2LM5K9q86Q3YkZEAQGinJL6n5NfWUhJA8OowfxdnoIj27\\n2toXeXCMWxptnao97lDgchYFSdFtQ7Fwxg/8KvZ0dvuakxnGjKT0AprdhaPycIoT\\nmp2Fr3FOndbChYNuCM8WYktsdwUzX1643Fu/pXLz3WVrprih/uJ8D4nBAoGAI9ky\\nIEkXM4DHfBm5V5opK0nrM/GsxbH6usCL8q5GPvNCeGoIBdCefiC1+8qh8p1SVXIF\\ngNKaE7HaLmgWH64j6Y3HRJCdn+hgJ4dLCk7kXknF71KlgOnAcxzKZAD2DeHllkSU\\nev/htWS8LMhoOs8muSeApx1XHu95jDFth8ZiDmECgYEAjJkaUqM88KiU9aiaJtCS\\n8YUpLhN8K7vuAvCRSSLkoMj8GFY8ycahzoBu7ooMD/m9HKB3PJ9qNZX3j3Bs7x8S\\nqcBfCVS0BY3OLIMhXKZy35SvbXJdrPFhbkr3LYxCi70MmlJUnlgFGw23FLdl4CYx\\nUeNzuIoGRA5b0zgdG5yBn2Q=\\n-----END PRIVATE KEY-----';

console.log("Input Length:", privateKeyRaw.length);

let base64Payload = privateKeyRaw
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '') // remove literal \n
    .replace(/\r/g, '')  // remove carriage returns
    .replace(/\n/g, '')  // remove actual newlines
    .replace(/\"/g, '')  // remove quotes
    .replace(/\'/g, '')  // remove quotes
    .replace(/\s+/g, ''); // remove any other whitespaces/tabs

let formattedKey = '';
for (let i = 0; i < base64Payload.length; i += 64) {
    formattedKey += base64Payload.substring(i, i + 64) + '\n';
}

const privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey.trim()}\n-----END PRIVATE KEY-----\n`;

console.log("Output:\n" + privateKey);

try {
    crypto.createPrivateKey(privateKey);
    console.log("SUCCESS: It's a valid PEM");
} catch (e) {
    console.error("FAILED to parse PEM:", e.message);
}
