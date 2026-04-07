'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

export default function StudentForm() {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: { first_name: string; middle_name: string | null; last_name: string }) => {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to add student');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setFirstName('');
      setMiddleName('');
      setLastName('');
      toast.success('Student added successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add student');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
    });
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-md border border-slate-200">
      <h2 className="text-2xl font-semibold text-black mb-6">Add Student</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-black mb-2">
            First Name *
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. John"
            required
            maxLength={50}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none placeholder:text-slate-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black mb-2">
            Middle Name (Optional)
          </label>
          <input
            type="text"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            placeholder="e.g. Michael"
            maxLength={50}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none placeholder:text-slate-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black mb-2">
            Last Name *
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="e.g. Doe"
            required
            maxLength={50}
            className="w-full px-4 py-2 border text-black border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full px-4 py-2 bg-black text-white rounded-lg font-semibold hover:bg-slate-200 cursor-pointer hover:text-black transition "
        >
          {mutation.isPending ? 'Adding...' : 'Add Student'}
        </button>

      </form>
    </div>
  );
}
