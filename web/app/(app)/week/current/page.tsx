import { redirect } from 'next/navigation';
import { currentMonday } from '@/shared/lib/dates';
export default function CurrentWeek() { redirect(`/week/${currentMonday()}`); }
