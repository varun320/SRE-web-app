-- Bump expense-receipts bucket size limit from 10MB → 15MB.
-- Phone photos routinely exceed 10MB; combined with client-side compression
-- 15MB gives comfortable headroom.

update storage.buckets
   set file_size_limit = 15728640  -- 15 MB
 where id = 'expense-receipts';
