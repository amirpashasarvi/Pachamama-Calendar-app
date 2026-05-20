import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { ConfigOption, UserRecord, UserRole, Room, RetreatType, TeamPosition, CalendarDisplaySettings, CalendarDisplayField } from '@/types';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, writeBatch, setDoc } from 'firebase/firestore';
import { Trash2, Plus, Save, ChevronRight, ChevronLeft, UserPlus, Shield, User, Pencil, GripVertical, Layout, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingTypes: ConfigOption[];
  bookingChannels: ConfigOption[];
  users: UserRecord[];
  rooms: Room[];
  retreatTypes: RetreatType[];
  teamPositions: TeamPosition[];
  displaySettings: CalendarDisplaySettings | null;
}

const COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', 
  '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6',
  '#fb7185', '#94a3b8', '#36454F'
];

type SettingsView = 'menu' | 'types' | 'channels' | 'users' | 'rooms' | 'retreats' | 'roster' | 'display';

function SortableItem({ id, children, disabled }: { id: string, children: React.ReactNode, key?: string, disabled?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div {...attributes} {...listeners} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <GripVertical size={14} />
      </div>
      {children}
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose, bookingTypes, bookingChannels, users, rooms, retreatTypes, teamPositions, displaySettings }: SettingsModalProps) {
  const [view, setView] = useState<SettingsView>('menu');
  const [limitWarning, setLimitWarning] = useState<boolean>(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Generic state for Types/Channels editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', color: '#36454F', commission: '' as number | '' });
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // User Management state
  const [userFormData, setUserFormData] = useState({ email: '', name: '', role: 'staff' as UserRole });
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const resetForms = () => {
    setEditingId(null);
    setFormData({ name: '', color: '#36454F', commission: '' });
    setIsAdding(false);
    setUserFormData({ email: '', name: '', role: 'staff' });
    setIsAddingUser(false);
    setEditingUserId(null);
    setConfirmDeleteId(null);
  };

  const handleBack = () => {
    setView('menu');
    resetForms();
  };

  const handleSaveOption = async (collectionName: string) => {
    if (!formData.name) return;
    const data: any = { 
      name: formData.name, 
      color: formData.color 
    };
    
    if (collectionName === 'bookingChannels') {
      data.commission = Number(formData.commission) || 0;
    }

    // Add defaults for new rooms
    if (collectionName === 'rooms' && !editingId) {
      data.type = 'Private Room';
      data.description = '';
      data.equipment = '';
      data.size = '';
      data.guestCount = 2;
      data.additionalBeds = 0;
      data.singleBeds = 0;
      data.doubleBeds = 0;
      data.order = rooms.length;
    }

    if (collectionName === 'teamPositions' && !editingId) {
      data.order = teamPositions.length;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, collectionName, editingId), data);
      } else {
        await addDoc(collection(db, collectionName), data);
      }
      resetForms();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, `${collectionName}/${editingId || ''}`);
    }
  };

  const handleDeleteOption = async (collectionName: string, id: string) => {
    try {
      await deleteDoc(doc(db, collectionName, id));
      setConfirmDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  const handleSaveUser = async () => {
    if (!userFormData.email || !userFormData.name) return;
    try {
      if (editingUserId) {
        await updateDoc(doc(db, 'users', editingUserId), { 
          email: userFormData.email,
          name: userFormData.name,
          role: userFormData.role 
        });
      } else {
        await addDoc(collection(db, 'users'), { 
          email: userFormData.email,
          name: userFormData.name,
          role: userFormData.role,
          createdAt: new Date().toISOString()
        });
      }
      resetForms();
    } catch (err) {
      handleFirestoreError(err, editingUserId ? OperationType.UPDATE : OperationType.CREATE, `users/${editingUserId || ''}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      setConfirmDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
    }
  };

  const handleRoomsDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = rooms.findIndex((room) => room.id === active.id);
      const newIndex = rooms.findIndex((room) => room.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(rooms, oldIndex, newIndex);
        
        // Update Firestore
        const batch = writeBatch(db);
        newOrder.forEach((room: Room, index: number) => {
          const roomRef = doc(db, 'rooms', room.id);
          batch.update(roomRef, { order: index });
        });

        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'rooms');
        }
      }
    }
  };

  const handleRosterDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = teamPositions.findIndex((p) => p.id === active.id);
      const newIndex = teamPositions.findIndex((p) => p.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(teamPositions, oldIndex, newIndex);
        
        // Update Firestore
        const batch = writeBatch(db);
        newOrder.forEach((pos: TeamPosition, index: number) => {
          const posRef = doc(db, 'teamPositions', pos.id);
          batch.update(posRef, { order: index });
        });

        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'teamPositions');
        }
      }
    }
  };

  const handleDisplayDragEnd = async (event: DragEndEvent, fieldSet: 'bookingBarFields' | 'teamRosterBarFields') => {
    const { active, over } = event;
    if (!displaySettings || !over || active.id === over.id) return;

    const fields = displaySettings[fieldSet];
    const oldIndex = fields.findIndex(f => f.id === active.id);
    const newIndex = fields.findIndex(f => f.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(fields, oldIndex, newIndex);
      try {
        await setDoc(doc(db, 'settings', 'calendarDisplay'), {
          ...displaySettings,
          [fieldSet]: newOrder
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'calendarDisplay');
      }
    }
  };

  const toggleDisplayField = async (fieldId: string, fieldSet: 'bookingBarFields' | 'teamRosterBarFields') => {
    if (!displaySettings) return;
    
    const fields = [...displaySettings[fieldSet]];
    const index = fields.findIndex(f => f.id === fieldId);
    if (index === -1) return;

    // Check constraints
    if (fieldId === 'guestName' || fieldId === 'name') return;

    const currentlyEnabledCount = fields.filter(f => f.enabled).length;
    const willBeEnabled = !fields[index].enabled;

    if (fieldSet === 'bookingBarFields' && willBeEnabled && currentlyEnabledCount >= 5) {
      setLimitWarning(true);
      setTimeout(() => setLimitWarning(false), 3000);
      return;
    }

    fields[index] = { ...fields[index], enabled: willBeEnabled };

    try {
      await setDoc(doc(db, 'settings', 'calendarDisplay'), {
        ...displaySettings,
        [fieldSet]: fields
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'calendarDisplay');
    }
  };

  const renderCalendarDisplayManagement = () => {
    if (!displaySettings) return null;

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={20} className="text-gray-500" />
          </button>
          <h3 className="font-bold text-lg">Calendar Display</h3>
        </div>

        {/* Booking Bars Section */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-1">Booking Bars</h4>
            <p className="text-[10px] text-gray-500">Enable and reorder fields shown on booking bars (Max 5)</p>
          </div>

          <div className="space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDisplayDragEnd(e, 'bookingBarFields')}
            >
              <SortableContext 
                items={displaySettings.bookingBarFields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {displaySettings.bookingBarFields.map(field => (
                  <SortableItem key={field.id} id={field.id}>
                    <div className="flex items-center justify-between p-3 bg-white border rounded-xl hover:shadow-sm transition-shadow group ml-8">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleDisplayField(field.id, 'bookingBarFields')}
                          className={cn(
                            "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center",
                            field.enabled 
                              ? "bg-blue-600 border-blue-600 text-white" 
                              : "border-gray-200 text-transparent"
                          )}
                          disabled={field.id === 'guestName'}
                        >
                          <Check size={14} strokeWidth={3} />
                        </button>
                        <span className={cn(
                          "text-sm font-semibold",
                          field.enabled ? "text-gray-700" : "text-gray-400"
                        )}>
                          {field.label}
                          {field.id === 'guestName' && <span className="ml-2 text-[10px] text-gray-400 font-normal">(Required)</span>}
                        </span>
                      </div>
                    </div>
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
          </div>
          
          {limitWarning && (
            <div className="flex items-center gap-2 text-rose-500 bg-rose-50 p-2 rounded-lg animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={14} />
              <span className="text-[10px] font-bold">Maximum 5 fields reached</span>
            </div>
          )}
        </div>

        {/* Team Roster Bars Section */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-1">Team Roster Bars</h4>
            <p className="text-[10px] text-gray-500">Customize fields for team assignment bars</p>
          </div>

          <div className="space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDisplayDragEnd(e, 'teamRosterBarFields')}
            >
              <SortableContext 
                items={displaySettings.teamRosterBarFields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {displaySettings.teamRosterBarFields.map(field => (
                  <SortableItem key={field.id} id={field.id}>
                    <div className="flex items-center justify-between p-3 bg-white border rounded-xl hover:shadow-sm transition-shadow group ml-8">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleDisplayField(field.id, 'teamRosterBarFields')}
                          className={cn(
                            "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center",
                            field.enabled 
                              ? "bg-blue-600 border-blue-600 text-white" 
                              : "border-gray-200 text-transparent"
                          )}
                          disabled={field.id === 'name'}
                        >
                          <Check size={14} strokeWidth={3} />
                        </button>
                        <span className={cn(
                          "text-sm font-semibold",
                          field.enabled ? "text-gray-700" : "text-gray-400"
                        )}>
                          {field.label}
                          {field.id === 'name' && <span className="ml-2 text-[10px] text-gray-400 font-normal">(Required)</span>}
                        </span>
                      </div>
                    </div>
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    );
  };

  const renderRoomsManagement = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <h3 className="font-bold text-lg">Rooms</h3>
      </div>

      {!isAdding && !editingId && (
        <button
          onClick={() => {
            setIsAdding(true);
            setFormData({ name: '', color: '#36454F', commission: '' });
          }}
          className="w-full py-2.5 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
        >
          <Plus size={14} /> Add New Room
        </button>
      )}

      {(isAdding || editingId) && (
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Room Name</label>
            <input
              autoFocus
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Room name..."
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase">Color Badge</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 active:scale-90 ${formData.color === c ? 'border-black' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setFormData({ ...formData, color: c })}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSaveOption('rooms')}
              className="flex-1 py-2 bg-black text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-800"
            >
              <Save size={14} /> {editingId ? 'Update Room' : 'Create Room'}
            </button>
            <button
              onClick={resetForms}
              className="px-4 py-2 bg-white border text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
        {rooms.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs italic">
            No rooms found. Add one above.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleRoomsDragEnd}
          >
            <SortableContext 
              items={rooms.map(r => r.id)}
              strategy={verticalListSortingStrategy}
            >
              {rooms.map(room => (
                <SortableItem key={room.id} id={room.id}>
                  <div className="flex items-center justify-between p-3 bg-white border rounded-xl hover:shadow-sm transition-shadow group ml-8">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: room.color }} />
                      <span className="text-sm font-semibold text-gray-700">{room.name}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {confirmDeleteId === room.id ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                          <span className="text-[10px] font-bold text-gray-500 italic">Delete this room?</span>
                          <button
                            onClick={() => handleDeleteOption('rooms', room.id)}
                            className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded hover:bg-rose-600 transition-colors"
                          >
                            Yes, delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(room.id);
                              setFormData({ 
                                name: room.name, 
                                color: room.color,
                                commission: 0
                              });
                              setIsAdding(false);
                              setConfirmDeleteId(null);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(room.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </SortableItem>
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );

  const renderRetreatsManagement = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <h3 className="font-bold text-lg">Our Retreats</h3>
      </div>

      {!isAdding && !editingId && (
        <button
          onClick={() => {
            setIsAdding(true);
            setFormData({ name: '', color: '', commission: '' });
          }}
          className="w-full py-2.5 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
        >
          <Plus size={14} /> Add New Retreat
        </button>
      )}

      {(isAdding || editingId) && (
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Retreat Name</label>
            <input
              autoFocus
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Yoga & Surf, Sound Healing..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleSaveOption('retreatTypes')}
              className="flex-1 py-2 bg-black text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-800"
            >
              <Save size={14} /> {editingId ? 'Update Retreat' : 'Create Retreat'}
            </button>
            <button
              onClick={resetForms}
              className="px-4 py-2 bg-white border text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
        {retreatTypes.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs italic">
            No retreat programs found. Add one above.
          </div>
        ) : (
          retreatTypes.map(retreat => (
            <div key={retreat.id} className="flex items-center justify-between p-3 bg-white border rounded-xl hover:shadow-sm transition-shadow group">
              <span className="text-sm font-semibold text-gray-700">{retreat.name}</span>
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                {confirmDeleteId === retreat.id ? (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                    <span className="text-[10px] font-bold text-gray-500 italic">Delete this retreat?</span>
                    <button
                      onClick={() => handleDeleteOption('retreatTypes', retreat.id)}
                      className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded hover:bg-rose-600 transition-colors"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(retreat.id);
                        setFormData({ 
                          name: retreat.name, 
                          color: '',
                          commission: 0
                        });
                        setIsAdding(false);
                        setConfirmDeleteId(null);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(retreat.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderConfigList = (options: ConfigOption[], collectionName: string, label: string) => {
    const isChannel = collectionName === 'bookingChannels';
    
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={20} className="text-gray-500" />
          </button>
          <h3 className="font-bold text-lg">{label}</h3>
        </div>

        {!isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-2.5 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
          >
            <Plus size={14} /> Add New Option
          </button>
        )}

        {(isAdding || editingId) && (
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Name</label>
              <input
                autoFocus
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Option name..."
              />
            </div>

            {isChannel && (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Commission %</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                    value={formData.commission}
                    onChange={e => setFormData({ ...formData, commission: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="0"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase">Color Badge</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 active:scale-90 ${formData.color === c ? 'border-black' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setFormData({ ...formData, color: c })}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveOption(collectionName)}
                className="flex-1 py-2 bg-black text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-800"
              >
                <Save size={14} /> Save Option
              </button>
              <button
                onClick={resetForms}
                className="px-4 py-2 bg-white border text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
          {options.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs italic">
              No options found. Add one above.
            </div>
          ) : (
            options.map(option => (
              <div 
                key={option.id}
                className="flex items-center justify-between p-3 bg-white border rounded-xl hover:shadow-sm transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: option.color }} />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">{option.name}</span>
                    {isChannel && option.commission !== undefined && option.commission > 0 && (
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {option.commission}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {confirmDeleteId === option.id ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                      <span className="text-[10px] font-bold text-gray-500 italic">Delete this item?</span>
                      <button
                        onClick={() => handleDeleteOption(collectionName, option.id)}
                        className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded hover:bg-rose-600 transition-colors"
                      >
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(option.id);
                          setFormData({ 
                            name: option.name, 
                            color: option.color,
                            commission: option.commission ?? 0
                          });
                          setIsAdding(false);
                          setConfirmDeleteId(null);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(option.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderUserManagement = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <h3 className="font-bold text-lg">User Management</h3>
      </div>

      {!isAddingUser && !editingUserId && (
        <button
          onClick={() => setIsAddingUser(true)}
          className="w-full py-2.5 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
        >
          <UserPlus size={14} /> Invite New User
        </button>
      )}

      {(isAddingUser || editingUserId) && (
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Full Name</label>
              <input
                autoFocus
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={userFormData.name}
                onChange={e => setUserFormData({ ...userFormData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Email Address</label>
              <input
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={userFormData.email}
                onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                placeholder="john@example.com"
                type="email"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Role</label>
              <select
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={userFormData.role}
                onChange={e => setUserFormData({ ...userFormData, role: e.target.value as UserRole })}
              >
                <option value="staff">Staff Member</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveUser}
              className="flex-1 py-2 bg-black text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-800"
            >
              <Save size={14} /> {editingUserId ? 'Update User' : 'Invite User'}
            </button>
            <button
              onClick={resetForms}
              className="px-4 py-2 bg-white border text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
        {users.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs italic">
            No users found. Invite one above.
          </div>
        ) : (
          users.map(user => (
            <div 
              key={user.id}
              className="flex items-center justify-between p-3 bg-white border rounded-xl hover:shadow-sm transition-shadow group"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${user.role === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-600'}`}>
                  {user.role === 'admin' ? <Shield size={16} /> : <User size={16} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700">{user.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {confirmDeleteId === user.id ? (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                    <span className="text-[10px] font-bold text-gray-500 italic">Delete this item?</span>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded hover:bg-rose-600 transition-colors"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingUserId(user.id);
                        setUserFormData({ email: user.email, name: user.name, role: user.role });
                        setIsAddingUser(false);
                        setConfirmDeleteId(null);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(user.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderRosterManagement = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <h3 className="font-bold text-lg">Team Roster</h3>
      </div>

      {!isAdding && !editingId && (
        <button
          onClick={() => {
            setIsAdding(true);
            setFormData({ name: '', color: '#36454F', commission: 0 });
          }}
          className="w-full py-2.5 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
        >
          <Plus size={14} /> Add New Position
        </button>
      )}

      {(isAdding || editingId) && (
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Position Name</label>
            <input
              autoFocus
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Host, Yoga Teacher, Kitchen..."
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase">Color Member Bar</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 active:scale-90 ${formData.color === c ? 'border-black' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setFormData({ ...formData, color: c })}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                handleSaveOption('teamPositions');
              }}
              className="flex-1 py-2 bg-black text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-800"
            >
              <Save size={14} /> {editingId ? 'Update Position' : 'Create Position'}
            </button>
            <button
              onClick={resetForms}
              className="px-4 py-2 bg-white border text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
        {teamPositions.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs italic">
            No positions found. Add one above.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleRosterDragEnd}
          >
            <SortableContext 
              items={teamPositions.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {teamPositions.map(pos => (
                <SortableItem key={pos.id} id={pos.id}>
                  <div className="flex items-center justify-between p-3 bg-white border rounded-xl hover:shadow-sm transition-shadow group ml-8">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pos.color }} />
                      <span className="text-sm font-semibold text-gray-700">{pos.name}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {confirmDeleteId === pos.id ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                          <span className="text-[10px] font-bold text-gray-500 italic">Delete this position?</span>
                          <button
                            onClick={() => handleDeleteOption('teamPositions', pos.id)}
                            className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded hover:bg-rose-600 transition-colors"
                          >
                            Yes, delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(pos.id);
                              setFormData({ 
                                name: pos.name, 
                                color: pos.color,
                                commission: 0
                              });
                              setIsAdding(false);
                              setConfirmDeleteId(null);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(pos.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </SortableItem>
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Operational Settings">
      <div className="min-h-[400px]">
        {view === 'menu' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-200">
            <button
              onClick={() => setView('types')}
              className="w-full flex items-center justify-between p-4 bg-white border rounded-2xl hover:border-blue-200 hover:bg-blue-50 transition-all group group"
            >
              <div className="text-left">
                <h4 className="font-bold text-gray-900">Booking Types</h4>
                <p className="text-xs text-gray-500">Manage booking type labels and colors</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => setView('channels')}
              className="w-full flex items-center justify-between p-4 bg-white border rounded-2xl hover:border-blue-200 hover:bg-blue-50 transition-all group"
            >
              <div className="text-left">
                <h4 className="font-bold text-gray-900">Booking Channels</h4>
                <p className="text-xs text-gray-500">Manage booking channel labels and colors</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => setView('users')}
              className="w-full flex items-center justify-between p-4 bg-white border rounded-2xl hover:border-blue-200 hover:bg-blue-50 transition-all group"
            >
              <div className="text-left">
                <h4 className="font-bold text-gray-900">User Management</h4>
                <p className="text-xs text-gray-500">Add, edit, or remove admins and staff members</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => setView('rooms')}
              className="w-full flex items-center justify-between p-4 bg-white border rounded-2xl hover:border-blue-200 hover:bg-blue-50 transition-all group"
            >
              <div className="text-left">
                <h4 className="font-bold text-gray-900">Rooms</h4>
                <p className="text-xs text-gray-500">Manage room names, colors and order</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => setView('retreats')}
              className="w-full flex items-center justify-between p-4 bg-white border rounded-2xl hover:border-blue-200 hover:bg-blue-50 transition-all group"
            >
              <div className="text-left">
                <h4 className="font-bold text-gray-900">Our Retreats</h4>
                <p className="text-xs text-gray-500">Manage your retreat programs</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => setView('roster')}
              className="w-full flex items-center justify-between p-4 bg-white border rounded-2xl hover:border-blue-200 hover:bg-blue-50 transition-all group"
            >
              <div className="text-left">
                <h4 className="font-bold text-gray-900">Team Roster</h4>
                <p className="text-xs text-gray-500">Manage team positions and roster</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => setView('display')}
              className="w-full flex items-center justify-between p-4 bg-white border rounded-2xl hover:border-blue-200 hover:bg-blue-50 transition-all group"
            >
              <div className="text-left">
                <h4 className="font-bold text-gray-900">Calendar Display</h4>
                <p className="text-xs text-gray-500">Customize what information appears on calendar bars</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        )}

        {view === 'types' && renderConfigList(bookingTypes, 'bookingTypes', 'Booking Types')}
        {view === 'channels' && renderConfigList(bookingChannels, 'bookingChannels', 'Booking Channels')}
        {view === 'users' && renderUserManagement()}
        {view === 'rooms' && renderRoomsManagement()}
        {view === 'retreats' && renderRetreatsManagement()}
        {view === 'roster' && renderRosterManagement()}
        {view === 'display' && renderCalendarDisplayManagement()}
      </div>
    </Modal>
  );
}
