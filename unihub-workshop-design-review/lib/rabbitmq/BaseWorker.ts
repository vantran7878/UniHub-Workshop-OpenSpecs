import { Channel, ConsumeMessage } from 'amqplib';
import RabbitMQProvider from './RabbitMQProvider';

export abstract class BaseWorker {
  protected abstract queueName: string;
  protected abstract exchangeName: string;
  protected abstract routingKey: string;

  public async start(): Promise<void> {
    try {
      const provider = RabbitMQProvider.getInstance();
      const channel = await provider.getChannel();

      // Assert Dead Letter Exchange and Queue
      await channel.assertExchange('dlx_exchange', 'direct', { durable: true });
      await channel.assertQueue('dlq_all', { durable: true });
      await channel.bindQueue('dlq_all', 'dlx_exchange', 'dlx_routing_key');

      // Assert Main Exchange
      await channel.assertExchange(this.exchangeName, 'direct', { durable: true });

      // Assert Main Queue
      await channel.assertQueue(this.queueName, { 
        durable: true,
        deadLetterExchange: 'dlx_exchange',
        deadLetterRoutingKey: 'dlx_routing_key'
      });

      // Bind Queue to Exchange
      await channel.bindQueue(this.queueName, this.exchangeName, this.routingKey);

      console.log(`[*] Worker started for queue: ${this.queueName}`);

      await channel.consume(this.queueName, (msg) => this.handleMessage(channel, msg), {
        noAck: false // Require manual acknowledgement
      });

      // Graceful Shutdown
      process.on('SIGTERM', async () => {
        console.log(`[!] SIGTERM received. Shutting down worker for ${this.queueName}`);
        await provider.close();
        process.exit(0);
      });

    } catch (error) {
      console.error(`[Worker Error] Failed to start worker for ${this.queueName}:`, error);
      // Auto-reconnect logic could be added here
      setTimeout(() => this.start(), 5000);
    }
  }

  private async handleMessage(channel: Channel, msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      console.log(`[Worker] Received message from ${this.queueName}:`, content);

      await this.process(content);

      channel.ack(msg); // Acknowledge successful processing
    } catch (error) {
      console.error(`[Worker Processing Error] ${this.queueName}:`, error);
      
      // Reject and don't requeue (send to DLX if configured)
      channel.nack(msg, false, false);
    }
  }

  protected abstract process(data: any): Promise<void>;
}
