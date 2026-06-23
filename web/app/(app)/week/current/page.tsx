import { redirect } from 'next/navigation';
import { currentMonday } from '@/lib/dates';
export default function CurrentWeek() { redirect(`/week/${currentMonday()}`); }
