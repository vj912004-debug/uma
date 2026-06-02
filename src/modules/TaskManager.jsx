import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Bell, Calendar, Clock, RotateCw, CheckCircle, Trash2, Edit2 } from 'lucide-react';

const TaskManager = () => {
  const { data, updateData, updateItem, setData } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    repeat: 'None', // 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'
    alarmEnabled: true,
    notes: '',
    status: 'Pending'
  });

  // ----------------------------------------------------
  // Live Alarm Checker
  // ----------------------------------------------------
  useEffect(() => {
    const checkAlarms = setInterval(() => {
      const now = new Date();
      const currentLocalDate = now.toISOString().split('T')[0];
      
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentLocalTime = `${hours}:${minutes}`;

      const pendingTasks = (data.tasks || []).filter(t => t.status === 'Pending');

      pendingTasks.forEach(task => {
        if (task.date === currentLocalDate && task.time === currentLocalTime) {
          // Trigger alarm!
          if (task.alarmEnabled) {
            // Play a soft alarm beep!
            try {
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              osc.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              osc.type = 'sine';
              osc.frequency.value = 880; // A5 note
              gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
              gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.1);
              gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
              osc.start();
              osc.stop(audioCtx.currentTime + 1);
            } catch (e) {
              console.warn("Audio context not allowed yet:", e);
            }

            alert(`🔔 ALARM REMINDER: "${task.title}" is due now!\nNotes: ${task.notes || 'None'}`);
          }

          // Handle repeat logic! If repeated, shift date; otherwise, mark done!
          if (task.repeat === 'None') {
            updateItem('tasks', task.id, { ...task, status: 'Completed' });
          } else {
            let nextDate = new Date(task.date);
            if (task.repeat === 'Daily') {
              nextDate.setDate(nextDate.getDate() + 1);
            } else if (task.repeat === 'Weekly') {
              nextDate.setDate(nextDate.getDate() + 7);
            } else if (task.repeat === 'Monthly') {
              nextDate.setMonth(nextDate.getMonth() + 1);
            } else if (task.repeat === 'Yearly') {
              nextDate.setFullYear(nextDate.getFullYear() + 1);
            }
            const nextDateStr = nextDate.toISOString().split('T')[0];
            updateItem('tasks', task.id, { ...task, date: nextDateStr });
          }
        }
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkAlarms);
  }, [data.tasks]);

  const handleEdit = (task) => {
    setForm(task);
    setIsEditing(task.id);
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title) return;

    if (isEditing) {
      updateItem('tasks', isEditing, { ...form });
    } else {
      const newTask = {
        ...form,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      };
      updateData('tasks', newTask);
    }
    setIsEditing(null);
    setIsModalOpen(false);
    setForm({
      title: '',
      date: new Date().toISOString().split('T')[0],
      time: '12:00',
      repeat: 'None',
      alarmEnabled: true,
      notes: '',
      status: 'Pending'
    });
  };

  const toggleTaskStatus = (task) => {
    const nextStatus = task.status === 'Pending' ? 'Completed' : 'Pending';
    updateItem('tasks', task.id, { ...task, status: nextStatus });
  };

  const deleteTask = (id) => {
    if (window.confirm("Delete this task?")) {
      deleteItemSoftly('tasks', id);
    }
  };

  const filteredTasks = (data.tasks || []).filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingTasks = filteredTasks.filter(t => t.status === 'Pending');
  const completedTasks = filteredTasks.filter(t => t.status === 'Completed');

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Task Reminders & Alarms</h1>
          <p style={{ color: 'var(--text-muted)' }}>Configure calendar notifications, repeat schedules, and real-time live alarm alerts.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Schedule Task
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Active Reminders */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} style={{ color: 'var(--accent-primary)' }} />
            Active Reminders ({pendingTasks.length})
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingTasks.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.85rem' }}>No active reminders scheduled.</p>
            ) : (
              pendingTasks.map(task => (
                <div key={task.id} className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>{task.title}</h4>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={12} /> {formatDate(task.date)}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} /> {task.time}</span>
                      {task.repeat !== 'None' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-primary)' }}><RotateCw size={12} /> {task.repeat}</span>
                      )}
                    </div>
                    {task.notes && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{task.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => handleEdit(task)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Edit Task">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => toggleTaskStatus(task)} style={{ background: 'transparent', border: 'none', color: 'rgba(16, 185, 129, 0.6)', cursor: 'pointer' }} title="Complete Task">
                      <CheckCircle size={18} />
                    </button>
                    <button onClick={() => deleteTask(task.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }} title="Delete Task">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* History Log */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.25rem' }}>History Logs</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {completedTasks.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.85rem' }}>No tasks completed yet.</p>
            ) : (
              completedTasks.map(task => (
                <div key={task.id} className="glass-panel" style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.02)', opacity: 0.6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{task.title}</h4>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Completed on {formatDate(task.date)} at {task.time}</p>
                  </div>
                  <button onClick={() => deleteTask(task.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.4)', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)' }}>
          <div className="premium-card" style={{ width: '500px', maxWidth: '90%' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Edit Task Reminder' : 'Schedule Task reminder'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Reminder Title *</label>
                  <input type="text" className="input-field" required placeholder="e.g. Call customer for pending balance reconciliation" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label>Due Date *</label>
                    <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                  </div>
                  <div>
                    <label>Due Time *</label>
                    <input type="time" className="input-field" required value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                  <div>
                    <label>Repeat alarm</label>
                    <select className="input-field" value={form.repeat} onChange={e => setForm({...form, repeat: e.target.value})}>
                      <option value="None">Once Only (None)</option>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={form.alarmEnabled} onChange={e => setForm({...form, alarmEnabled: e.target.checked})} />
                    Enable Live Alarm trigger
                  </label>
                </div>

                <div>
                  <label>Work Instructions / Task Description</label>
                  <textarea className="input-field" rows="3" placeholder="Enter instructions, numbers, email contents..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Reminder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManager;
