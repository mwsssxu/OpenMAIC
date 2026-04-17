'use client';

import React, { useState } from 'react';

interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, children, className = '' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <div className={className}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ activeTab?: string; setActiveTab?: (v: string) => void }>, {
            activeTab,
            setActiveTab,
          });
        }
        return child;
      })}
    </div>
  );
}

interface TabsListProps {
  children: React.ReactNode;
  activeTab?: string;
  setActiveTab?: (value: string) => void;
  className?: string;
}

export function TabsList({ children, activeTab, setActiveTab, className = '' }: TabsListProps) {
  return (
    <div className={`flex gap-2 border-b mb-4 ${className}`}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ activeTab?: string; setActiveTab?: (v: string) => void }>, {
            activeTab,
            setActiveTab,
          });
        }
        return child;
      })}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  activeTab?: string;
  setActiveTab?: (value: string) => void;
  className?: string;
}

export function TabsTrigger({ value, children, activeTab, setActiveTab, className = '' }: TabsTriggerProps) {
  const isActive = activeTab === value;

  return (
    <button
      className={`px-4 py-2 font-medium transition-colors rounded-t-lg ${
        isActive
          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
          : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
      } ${className}`}
      onClick={() => setActiveTab?.(value)}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  activeTab?: string;
  className?: string;
}

export function TabsContent({ value, children, activeTab, className = '' }: TabsContentProps) {
  if (activeTab !== value) return null;

  return (
    <div className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
}