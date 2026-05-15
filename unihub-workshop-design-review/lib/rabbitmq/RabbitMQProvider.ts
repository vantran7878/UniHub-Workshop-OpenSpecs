import amqp, { Connection, Channel } from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

class RabbitMQProvider {
  private static instance: RabbitMQProvider;
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  private constructor() {}

  public static getInstance(): RabbitMQProvider {
    if (!RabbitMQProvider.instance) {
      RabbitMQProvider.instance = new RabbitMQProvider();
    }
    return RabbitMQProvider.instance;
  }

  public async getChannel(): Promise<Channel> {
    if (this.channel) return this.channel;

    try {
      if (!this.connection) {
        this.connection = await amqp.connect(RABBITMQ_URL);
        
        this.connection.on('error', (err) => {
          console.error('[RabbitMQ] Connection Error:', err);
          this.connection = null;
          this.channel = null;
        });

        this.connection.on('close', () => {
          console.log('[RabbitMQ] Connection Closed');
          this.connection = null;
          this.channel = null;
        });
      }

      this.channel = await this.connection.createChannel();
      console.log('[RabbitMQ] Channel Created');
      
      return this.channel;
    } catch (error) {
      console.error('[RabbitMQ] Failed to create channel:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}

export default RabbitMQProvider;
