export type Platform = "devpost" | "mlh" | "eventbrite" | "luma" | "gdg";

export interface Hackathon {
  id: string;
  title: string;
  description: string | null;
  desc_translated: string | null;
  url: string;
  platform: Platform;
  start_date: string | null;
  end_date: string | null;
  deadline: string | null;
  location: string | null;
  is_online: boolean;
  prize_pool: string | null;
  prize_amount: number | null;
  tags: string[];
  image_url: string | null;
  organizer: string | null;
  scraped_at: string;
  created_at: string;
}

export interface SearchParams {
  query: string;
  online?: boolean;
  platform?: Platform;
  limit?: number;
}
