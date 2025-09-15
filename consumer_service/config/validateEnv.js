module.exports = () => {
  const requiredVars = [
    "PORT",
    "CUSTOMER_DB_URI",
    "RABBITMQ_URI",
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length) {
    console.error("Missing environment variables:", missing.join(", "));
    process.exit(1);
  }
  console.log("All environment variables validated.")
};
