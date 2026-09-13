import {Skeleton} from '@/components/ui/skeleton';
export default function Loading(){return <div className="flex flex-col gap-6 p-8"><Skeleton className="h-10 w-48"/><Skeleton className="h-20 w-full"/><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1,2,3,4,5,6,7,8].map(i=><Skeleton key={i} className="h-40"/>)}</div></div>;}
