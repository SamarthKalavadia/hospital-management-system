const bcrypt = require("bcryptjs");
const pw = "password123";
const hash = bcrypt.hashSync(pw, 10);
console.log("PW:", pw);
console.log("HASH:", hash);
console.log("START:", hash.substring(0, 10));
console.log("COMPARE:", bcrypt.compareSync(pw, hash));
