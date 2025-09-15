const mongoose = require("mongoose");

let customerDbConn;

async function connectCustomerDB() {
  if (customerDbConn) return customerDbConn;

  customerDbConn = await mongoose.createConnection(process.env.CUSTOMER_DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("Connected to Customer DB");
  return customerDbConn;
}

module.exports = connectCustomerDB;
