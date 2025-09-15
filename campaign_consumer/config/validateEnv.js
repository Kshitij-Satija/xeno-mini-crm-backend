// config/validateEnv.js
module.exports = () => {
  const requiredVars = [
    "CAMPAIGN_DB_URI",           // MongoDB URI for Campaigns
    "CUSTOMER_DB_URI",           // MongoDB URI for Customers (used in campaign consumer)
    "RABBITMQ_URI",              // RabbitMQ connection string
     "VENDOR_API_URI",   // Dummy vendor API endpoint for sending messages  "VENDOR_SERVICE_URI",   
     
    "PORT",                      // Service port
    "NODE_ENV"                   // Environment (development/production)
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length) {
    console.error("Missing environment variables:", missing.join(", "));
    process.exit(1);
  }
};
