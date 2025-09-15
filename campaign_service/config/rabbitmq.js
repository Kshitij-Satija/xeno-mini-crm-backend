const amqp = require("amqplib");

let channel;

const connectRabbitMQ = async () => {
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URI);
    channel = await conn.createChannel();
    console.log("RabbitMQ connected (Campaign Service)");
    return channel;
  } catch (err) {
    console.error("RabbitMQ connection error:", err.message);
    process.exit(1);
  }
};

const getChannel = () => {
  if (!channel) throw new Error("RabbitMQ channel not initialized yet");
  return channel;
};

module.exports = { connectRabbitMQ, getChannel };
