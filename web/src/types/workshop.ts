export interface Workshop {
  id: string;
  title: string;
  description: string;
  speaker: string;
  room: string;
  capacity: number;
  start_time: string;
  end_time: string;
  is_paid: boolean;
  price: number;
  status: 'active' | 'cancelled' | 'completed';
  registration_open_at: string;
  registration_close_at: string;
  seats_available?: number; // From cache/computed
}
