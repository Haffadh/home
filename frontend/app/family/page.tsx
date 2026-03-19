"use client";

import { useEffect, useState } from "react";
import { getApiBase } from "../../lib/api";

type FamilyMember = {
  id: string;
  name: string;
  role?: string;
};

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  async function loadMembers() {
    try {
      const data = (await getApiBase("/api/family")) as FamilyMember[];
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load family members", err);
    } finally {
      setLoading(false);
    }
  }

  async function addMember() {
    if (!name.trim()) return;

    try {
      const newMember = (await getApiBase("/api/family/add?name=" + encodeURIComponent(name))) as FamilyMember;

      setMembers((prev) => [...prev, newMember]);
      setName("");
    } catch (err) {
      console.error("Failed to add member", err);
    }
  }

  async function removeMember(id: string) {
    try {
      await getApiBase(`/api/family/remove/${id}`);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to remove member", err);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  if (loading) return <div className="p-6">Loading family members...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Family</h1>

      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2"
          placeholder="Family member name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          onClick={addMember}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Add
        </button>
      </div>

      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between border rounded p-3"
          >
            <div>
              <div className="font-medium">{member.name}</div>
              {member.role && (
                <div className="text-sm text-gray-500">{member.role}</div>
              )}
            </div>

            <button
              onClick={() => removeMember(member.id)}
              className="text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}