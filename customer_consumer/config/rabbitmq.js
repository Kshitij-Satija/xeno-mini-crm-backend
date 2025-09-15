const amqp = require("amqplib");

let channel;

const connectRabbitMQ = async (retries = 5, delay = 5000) => {
  if (!process.env.RABBITMQ_URI) throw new Error("RABBITMQ_URI missing");

  for (let i = 0; i < retries; i++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URI);
      channel = await conn.createChannel();
      console.log("RabbitMQ connected");
      return channel;
    } catch (err) {
      console.error(`RabbitMQ connection error (attempt ${i + 1} of ${retries}):`, err.message);
      if (i < retries - 1) {
        console.log(`Retrying RabbitMQ connection in ${delay / 1000} seconds...`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        console.error("Max retries reached. Could not connect to RabbitMQ.");
        process.exit(1);
      }
    }
  }
};

// Ensure consumers always get the initialized channel
const getChannel = () => {
  if (!channel) throw new Error("RabbitMQ channel not initialized yet");
  return channel;
};

module.exports = { connectRabbitMQ, getChannel };
