'use client';

 import { useState, useEffect } from 'react';
 import { Header } from '@/components/Header';
 import { Footer } from '@/components/Footer';
 import { MarketCard } from '@/components/MarketCard';
 import { MarketCardSkeleton } from '@/components/MarketCardSkeleton';
 import { PageTransition } from '@/components/PageTransition';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { useStore } from '@/lib/store';
 import { Search, Grid3x3, LayoutList, Filter } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 const categories = [
   { value: 'all', label: 'All Markets' },
   { value: 'youtube', label: 'YouTube' },
   { value: 'streaming', label: 'Streaming' },
   { value: 'movies', label: 'Movies' },
   { value: 'music', label: 'Music' },
   { value: 'gaming', label: 'Gaming' },
   { value: 'tv shows', label: 'TV Shows' },
 ];
 
 const Markets = () => {
   const markets = useStore((state) => state.markets);
   const [searchQuery, setSearchQuery] = useState('');
   const [selectedCategory, setSelectedCategory] = useState<string>('all');
   const [sortBy, setSortBy] = useState<string>('volume');
   const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
   const [isLoading, setIsLoading] = useState(true);
 
   useEffect(() => {
     const timer = setTimeout(() => setIsLoading(false), 800);
     return () => clearTimeout(timer);
   }, []);
 
   const filteredMarkets = markets
     .filter(market => {
       const matchesSearch = market.question.toLowerCase().includes(searchQuery.toLowerCase());
       const matchesCategory = selectedCategory === 'all' || market.category.toLowerCase() === selectedCategory;
       return matchesSearch && matchesCategory;
     })
     .sort((a, b) => {
       switch (sortBy) {
         case 'volume': return b.volume - a.volume;
         case 'newest': return b.endDate.getTime() - a.endDate.getTime();
         case 'ending-soon': return a.endDate.getTime() - b.endDate.getTime();
         case 'most-active': return b.participants - a.participants;
         default: return 0;
       }
     });
 
   return (
     <div className="min-h-screen flex flex-col bg-background">
       <Header />
       
       <PageTransition>
         <main className="flex-1 container mx-auto px-4 py-8 pt-12">
           {/* Page Header */}
           <div className="mb-8">
             <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Markets</h1>
             <p className="text-muted-foreground text-sm">
               {markets.length} active prediction markets
             </p>
           </div>
 
           {/* Category Pills */}
           <div className="flex gap-2 mb-6 flex-wrap">
             {categories.map((cat) => (
               <button
                 key={cat.value}
                 onClick={() => setSelectedCategory(cat.value)}
                 className={cn(
                   "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                   selectedCategory === cat.value
                     ? "bg-foreground text-background"
                     : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                 )}
               >
                 {cat.label}
               </button>
             ))}
           </div>
 
           {/* Search and Controls */}
           <div className="flex gap-3 flex-wrap mb-8">
             <div className="relative flex-1 min-w-[240px]">
               <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                 placeholder="Search markets..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="pl-10 h-11 bg-muted/30 border-border/30 focus:border-border/60"
               />
             </div>
             
             <Select value={sortBy} onValueChange={setSortBy}>
               <SelectTrigger className="w-[180px] h-11 bg-muted/30 border-border/30">
                 <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                 <SelectValue placeholder="Sort by" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="volume">Highest Volume</SelectItem>
                 <SelectItem value="newest">Newest First</SelectItem>
                 <SelectItem value="ending-soon">Ending Soon</SelectItem>
                 <SelectItem value="most-active">Most Active</SelectItem>
               </SelectContent>
             </Select>
 
             <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg">
               <Button 
                 variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                 size="icon" 
                 onClick={() => setViewMode('grid')} 
                 className="h-9 w-9"
               >
                 <Grid3x3 className="h-4 w-4" />
               </Button>
               <Button 
                 variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                 size="icon" 
                 onClick={() => setViewMode('list')} 
                 className="h-9 w-9"
               >
                 <LayoutList className="h-4 w-4" />
               </Button>
             </div>
           </div>
 
           {/* Results count */}
           <p className="text-sm text-muted-foreground mb-6">
             Showing {filteredMarkets.length} {filteredMarkets.length === 1 ? 'market' : 'markets'}
           </p>
 
           {/* Markets Grid/List */}
           {filteredMarkets.length > 0 ? (
             <div className={cn(
               viewMode === 'grid' 
                 ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-5' 
                 : 'flex flex-col gap-3'
             )}>
               {isLoading ? (
                 Array.from({ length: 6 }).map((_, i) => (
                   <MarketCardSkeleton key={i} />
                 ))
               ) : (
                 filteredMarkets.map((market, i) => (
                   <div 
                     key={market.id} 
                     className="stagger-in" 
                     style={{ animationDelay: `${i * 40}ms` }}
                   >
                     <MarketCard market={market} compact={viewMode === 'list'} />
                   </div>
                 ))
               )}
             </div>
           ) : (
             <div className="text-center py-20 rounded-2xl bg-muted/20 border border-border/30">
               <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                 <Search className="h-7 w-7 text-muted-foreground" />
               </div>
               <p className="text-muted-foreground mb-4">No markets found</p>
               <Button 
                 variant="outline" 
                 onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
               >
                 Clear Filters
               </Button>
             </div>
           )}
         </main>
       </PageTransition>
       <Footer />
     </div>
   );
 };
 
 export default Markets;
