import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase connection
const supabaseUrl = 'https://bkxtmevrfpfhwrwildpx.supabase.co'
const supabaseAnonKey = 'sb_publishable_zkt89flZIVC5aEtgR7eOLQ_y20L9oGY'
const supabase = createClient(supabaseUrl, supabaseAnonKey)


// Get logged in teacher info
const userId = sessionStorage.getItem('userId')
const userRole = sessionStorage.getItem('userRole')
const userName = sessionStorage.getItem('userName')

// Check if logged in and is teacher
if (!userId || userRole !== 'teacher') {
    alert('Please login as teacher')
    window.location.href = 'login.html'
}
 
// Display teacher name
document.getElementById('teacherName').textContent = `Mr./Ms. ${userName || 'Teacher'}`

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.clear()
    window.location.href = '/page/login/login.html'
})

// Load teacher classes
async function loadTeacherClasses() {
    const container = document.getElementById('classesContainer')
    
    try {
        // Query database
        const { data: classes, error } = await supabase
            .from('classes')
            .select('*')
            .eq('teacher_id', parseInt(userId))
            .order('id', { ascending: true })
        
        if (error) throw error
        
        if (!classes || classes.length === 0) {
            container.innerHTML = '<div class="no-classes">No classes assigned to you.</div>'
            return
        }
        
        container.innerHTML = ''
        
        // Loops through each class
        for (const classItem of classes) {

            // Formating Class Day 
            const daysMap = { 'M': 'Mon', 'T': 'Tue', 'W': 'Wed', 'Th': 'Thu', 'F': 'Fri', 'S': 'Sat' }
            const daysDisplay = classItem.class_day?.map(d => daysMap[d] || d).join(', ') || 'N/A'
            
            // Formating Class Time
            const formatTime = (time) => {
                if (!time) return 'N/A'
                const [hour, minute] = time.split(':')
                const hour12 = hour % 12 || 12
                const ampm = hour >= 12 ? 'PM' : 'AM'
                return `${hour12}:${minute} ${ampm}`
            }
            
            // Formating Class Loc
            const location = `${classItem.class_building || ''} ${classItem.class_room || ''}`.trim() || 'N/A'
            
            // Formating Class block/s
            const blocksDisplay = classItem.blocks ? classItem.blocks.join(', ') : 'N/A'
            
            // CLass Color
            const classColor = classItem.class_color || '#0077FF'
            
            // Build Class Card
            container.innerHTML += `
                <div class="class-card" onclick="goToClass('${classItem.id}', '${classItem.subject}')">
                    <div class="class-color-bar" style="background-color: ${classColor};"></div>
                    <div class="class-content">
                        <div class="class-subject">${classItem.subject || 'N/A'}</div>
                        <div class="class-detail"><strong>Class Code:</strong> ${classItem.id}</div>
                        <div class="class-detail"><strong>Program:</strong> ${classItem.program}</div>
                        <div class="class-detail"><strong>Class Level:</strong> ${classItem.class_level || 'N/A'}</div>
                        <div class="class-detail"><strong>Class Block:</strong> ${blocksDisplay}</div>
                        <div class="class-detail"><strong>Class Day:</strong> ${daysDisplay}</div>
                        <div class="class-detail"><strong>Class Time:</strong> ${formatTime(classItem.class_time_start)} - ${formatTime(classItem.class_time_end)}</div>
                        <div class="class-detail"><strong>Class Loc:</strong> ${location}</div>
                    </div>
                </div>
            `
        }
    } catch (error) {
        console.error('Error:', error)
        container.innerHTML = '<div class="loading">Error loading classes</div>'
    }
}

// Enter Clicked Class
window.goToClass = (classId, className) => {
    // Store selected class info
    sessionStorage.setItem('selectedClassId', classId)
    sessionStorage.setItem('selectedClassName', className)
    window.location.href = 'teacherClassDetail.html'
}

// Initialize
loadTeacherClasses()