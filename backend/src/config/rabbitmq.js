const amqp = require('amqplib');
require('dotenv').config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
let connection = null;
let channel = null;

async function connectRabbitMQ() {
  if (channel) return { connection, channel };

  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    
    // Durable queue for AI summary generation
    await channel.assertQueue('ai_summary.generate', { durable: true });
    
    console.log('Connected to RabbitMQ and initialized ai_summary.generate queue');
    return { connection, channel };
  } catch (err) {
    console.error('RabbitMQ connection error:', err);
    throw err;
  }
}

module.exports = {
  connectRabbitMQ,
  getChannel: () => channel
};
