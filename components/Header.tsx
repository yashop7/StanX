import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Clapperboard, 
  Menu, 
  User, 
  Wallet, 
  Settings, 
  LogOut,
  ChevronDown,
  BarChart3,
  History,
  Plus
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';

export const Header = () => {
  const isLoggedIn = true;

  return (
    <header className="sticky top-0 z-50 w-full navbar-blur border-b border-border/40">
      <div className="max-w-[1400px] mx-auto">
        <nav>
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2.5 font-bold text-lg group">
                <div className="p-1.5 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/15 transition-colors">
                  <Clapperboard className="h-5 w-5 text-purple-400" />
                </div>
                <span className="tracking-tight">Finwe</span>
              </Link>
              
              <nav className="hidden md:flex items-center gap-1">
                <Link 
                  href="/markets" 
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-muted/50"
                >
                  Markets
                </Link>
                <Link 
                  href="/portfolio" 
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-muted/50"
                >
                  Portfolio
                </Link>
              </nav>
            </div>
            
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  {/* Create Market Button */}
                  <Link href="/create-market">
                    <Button size="sm" variant="outline" className="rounded-lg border border-success/30 bg-success/5 hover:bg-success/10 transition-colors text-success">
                      <Plus className="h-4 w-4" />
                      <span className="text-sm font-medium">Create</span>
                    </Button>
                  </Link>

                  {/* Balance Display */}
                  <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 surface-input rounded-lg">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold tabular-nums">$10,000</span>
                  </div>

                  <ThemeToggle />
                  
                  {/* User Dropdown Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2 px-2 hover:bg-muted/50 hover-scale">
                        <Avatar className="h-7 w-7 ring-2 ring-border/50">
                          <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face" />
                          <AvatarFallback className="text-xs bg-muted">JD</AvatarFallback>
                        </Avatar>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 glass-card border-border/40">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">John Doe</p>
                          <p className="text-xs text-muted-foreground">john@example.com</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-border/50" />
                      <DropdownMenuItem asChild className="hover-scale">
                        <Link href="/portfolio" className="flex items-center cursor-pointer">
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Portfolio
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="hover-scale">
                        <Link href="/account" className="flex items-center cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          Account
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="hover-scale">
                        <Link href="/create-market" className="flex items-center cursor-pointer">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Market
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="hover-scale">
                        <History className="mr-2 h-4 w-4" />
                        Trade History
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/50" />
                      <DropdownMenuItem className="hover-scale">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/50" />
                      <DropdownMenuItem className="text-destructive focus:text-destructive hover-scale">
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <ThemeToggle />
                  <Link href="/auth">
                    <Button variant="ghost" size="sm" className="text-sm font-medium hover-scale">
                      Log in
                    </Button>
                  </Link>
                  <Link href="/auth">
                    <Button size="sm" className="text-sm font-medium hover-scale">
                      Sign up
                    </Button>
                  </Link>
                </>
              )}
              
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 hover-scale">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
};
