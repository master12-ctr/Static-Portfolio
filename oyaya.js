const bcrypt = require('bcryptjs');

const plainPassword = 'oyaya'; // The password you want to hash
const hashedPassword = bcrypt.hashSync(plainPassword, 10); // Hashing with 10 salt rounds

console.log(hashedPassword);