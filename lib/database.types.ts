export type Message = {
  id: string;
  sender_id: string;
  text: string | null;
  image_url: string | null;
  reaction: string | null;
  is_read: boolean;
  created_at: string;
};

export type BucketListItem = {
  id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
};

export type CoupleMemory = {
  id: string;
  title: string;
  memory_date: string;
  mood: string;
  image_path: string;
  created_by: string;
  created_at: string;
};

export type CoupleMemoryLike = {
  memory_id: string;
  user_id: string;
  created_at: string;
};
