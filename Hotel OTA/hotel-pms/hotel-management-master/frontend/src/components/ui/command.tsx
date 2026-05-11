import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Input } from '@/components/ui/input';

// Command Context
const CommandContext = React.createContext<{
  search: string;
  setSearch: (search: string) => void;
}>({
  search: '',
  setSearch: () => {}
});

// Command Root Component
export interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Command: React.FC<CommandProps> = ({ 
  children, 
  className,
  ...props 
}) => {
  const [search, setSearch] = React.useState('');

  return (
    <CommandContext.Provider value={{ search, setSearch }}>
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-md bg-white text-slate-950",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  );
};

// Command Input Component
export interface CommandInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  placeholder?: string;
}

export const CommandInput: React.FC<CommandInputProps> = ({
  className,
  placeholder = "Search...",
  ...props
}) => {
  const { search, setSearch } = React.useContext(CommandContext);

  return (
    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0 focus:border-0 shadow-none",
          className
        )}
        {...props}
      />
    </div>
  );
};

// Command Empty Component
export interface CommandEmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CommandEmpty: React.FC<CommandEmptyProps> = ({
  children,
  className,
  ...props
}) => {
  const { search } = React.useContext(CommandContext);
  
  // Only show if there's a search term
  if (!search) return null;

  return (
    <div
      className={cn("py-6 text-center text-sm text-slate-500", className)}
      {...props}
    >
      {children}
    </div>
  );
};

// Command Group Component
export interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: string;
  children: React.ReactNode;
}

export const CommandGroup: React.FC<CommandGroupProps> = ({
  heading,
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn("overflow-hidden p-1 text-slate-950", className)}
      {...props}
    >
      {heading && (
        <div className="px-2 py-1.5 text-xs font-medium text-slate-500">
          {heading}
        </div>
      )}
      <div role="group">
        {children}
      </div>
    </div>
  );
};

// Command Item Component  
export interface CommandItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onSelect?: (value: string) => void;
  children: React.ReactNode;
}

export const CommandItem: React.FC<CommandItemProps> = ({
  value = '',
  onSelect,
  children,
  className,
  ...props
}) => {
  const { search } = React.useContext(CommandContext);
  
  // Simple search filtering - hide items that don't match
  const shouldShow = !search || 
    value.toLowerCase().includes(search.toLowerCase()) ||
    React.Children.toArray(children).some(child => 
      typeof child === 'string' && child.toLowerCase().includes(search.toLowerCase())
    );

  if (!shouldShow) return null;

  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      onClick={() => onSelect?.(value)}
      role="option"
      {...props}
    >
      {children}
    </div>
  );
};

// Command List Component (container for items)
export interface CommandListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CommandList: React.FC<CommandListProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
      role="listbox"
      {...props}
    >
      {children}
    </div>
  );
};

// Command Separator Component
export interface CommandSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CommandSeparator: React.FC<CommandSeparatorProps> = ({
  className,
  ...props
}) => {
  return (
    <div
      className={cn("-mx-1 h-px bg-slate-200", className)}
      {...props}
    />
  );
};

export { Command as default };