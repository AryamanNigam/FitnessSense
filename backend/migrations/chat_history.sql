create table if not exists chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_history_user_created_idx on chat_history (user_id, created_at desc);

alter table chat_history enable row level security;

create policy "chat_history_select_own" on chat_history for select using (auth.uid() = user_id);
create policy "chat_history_insert_own" on chat_history for insert with check (auth.uid() = user_id);
create policy "chat_history_delete_own" on chat_history for delete using (auth.uid() = user_id);
