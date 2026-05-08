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

    // Notification Queue
    await channel.assertExchange('notification.exchange', 'direct', { durable: true });
    
    // Retry Queue (DLX)
    await channel.assertQueue('notification.retry', {
      durable: true,
      arguments: {
        'x-message-ttl': 60000, // 60 seconds
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'notification.queue'
      }
    });

    await channel.assertQueue('notification.queue', { durable: true });
    await channel.bindQueue('notification.queue', 'notification.exchange', 'notification.key');

    console.log('RabbitMQ queues initialized');
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
