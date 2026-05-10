import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase connection
const supabaseUrl = 'https://bkxtmevrfpfhwrwildpx.supabase.co'
const supabaseAnonKey = 'sb_publishable_zkt89flZIVC5aEtgR7eOLQ_y20L9oGY'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Get logged in student info
const userId = sessionStorage.getItem('userId')
const userRole = sessionStorage.getItem('userRole')
const userName = sessionStorage.getItem('userName')

// Check if logged in and is student
if (!userId || userRole !== 'student') {
    alert('Please login as student')
    window.location.href = '/page/login/login.html'
}

// Display student name
document.getElementById('studentName').textContent = userName || 'Student'

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.clear()
    window.location.href = '/page/login/login.html'
})

// Modal functions
window.showModal = (modalId) => {
    document.getElementById(modalId).style.display = 'flex'
}
window.closeModal = (modalId) => {
    document.getElementById(modalId).style.display = 'none'
}


// QR code Logic
let currentQRCanvas = null

async function showMyQRCode() {
    try {
        // Query database (student info and QR value from users Table)
        const { data: student } = await supabase
            .from('users')
            .select('*')
            .eq('id', parseInt(userId))
            .single()
        
        if (student) { 
            // Fill student info in modal
            document.getElementById('qrStudentId').textContent = userId
            document.getElementById('qrStudentProgram').textContent = student.program || 'N/A'
            document.getElementById('qrStudentName').textContent = student.name || 'N/A'
            document.getElementById('qrStudentEmail').textContent = student.email || 'N/A'
            document.getElementById('qrStudentPhone').textContent = student.phone || 'N/A'
            
            // assign the QR code
            let qrValue = student.qr_value
            
            // Where to put the QR code
            const qrDisplay = document.getElementById('qrCodeDisplay')
            qrDisplay.innerHTML = ''
            const canvas = document.createElement('canvas')
            currentQRCanvas = canvas
            
            // QR generation
            QRCode.toCanvas(canvas, qrValue, { width: 260, margin: 1 }, (error) => {
                if (error) {
                    qrDisplay.innerHTML = '<p style="color:red;">Error generating QR code</p>'
                } else {
                    qrDisplay.appendChild(canvas)
                }
            })
            
            // Show the modal
            showModal('qrModal')
        }
    } catch (error) {
        alert("Error: " + error.message)
    }
}

// Download QR code
document.getElementById('downloadQrBtn').addEventListener('click', () => {
    if (currentQRCanvas) {
        const link = document.createElement('a')
        link.download = `QR_${userId}.png`
        link.href = currentQRCanvas.toDataURL()
        link.click()
    } else {
        const canvas = document.querySelector('#qrCodeDisplay canvas')
        if (canvas) {
            const link = document.createElement('a')
            link.download = `QR_${userId}.png`
            link.href = canvas.toDataURL()
            link.click()
        } else {
            alert("No QR code to download")
        }
    }
})

// View QR button 
document.getElementById('showQrBtn').addEventListener('click', showMyQRCode)

// Load student classes
async function loadStudentClasses() {
    const container = document.getElementById('classesContainer')
    
    try {
        // Get enrollments
        const { data: enrollments, error: enrollError } = await supabase
            .from('class_list')
            .select('class_id')
            .eq('student_id', parseInt(userId))
        
        if (enrollError) throw enrollError
        
        if (!enrollments || enrollments.length === 0) {
            container.innerHTML = '<div class="no-classes">You are not enrolled in any classes.</div>'
            return
        }
        
        // Get class IDs
        const classIds = enrollments.map(e => e.class_id)
        
        // Get class details
        const { data: classes, error: classError } = await supabase
            .from('classes')
            .select('*')
            .in('id', classIds)
            .order('id', { ascending: true }) 
        
        if (classError) throw classError
        
        // Show if no classes found
        if (!classes || classes.length === 0) {
            container.innerHTML = '<div class="no-classes">No classes found.</div>'
            return
        }
        
        
        // Get all unique teacher IDs from the classes
        const teacherIds = [...new Set(classes.map(c => c.teacher_id).filter(id => id))]
        
        // Create a map of teacher ID to teacher data
        let teacherMap = {}
        if (teacherIds.length > 0) {
            const { data: teachers } = await supabase
                .from('users')
                .select('id, name, email, phone')
                .in('id', teacherIds)
            
            if (teachers) {
                teachers.forEach(teacher => {
                    teacherMap[teacher.id] = teacher
                })
            }
        }

        // reset page
        container.innerHTML = ''
        
        // Loop through each class
        for (const classItem of classes) {
            
            // teacher info
            const teacher = teacherMap[classItem.teacher_id]
            const teacherName = teacher?.name || 'Not assigned'
            const teacherEmail = teacher?.email || ''
            const teacherPhone = teacher?.phone || ''
           
            
            // Format days
            const daysMap = { 'M': 'Mon', 'T': 'Tue', 'W': 'Wed', 'Th': 'Thu', 'F': 'Fri', 'S': 'Sat' }
            const daysDisplay = classItem.class_day?.map(d => daysMap[d] || d).join(', ') || 'N/A'
            
            // Format time
            const formatTime = (time) => {
                if (!time) return 'N/A'
                const [hour, minute] = time.split(':')
                const hour12 = hour % 12 || 12
                const ampm = hour >= 12 ? 'PM' : 'AM'
                return `${hour12}:${minute} ${ampm}`
            }
            
            // Format location
            const location = `${classItem.class_building || ''} ${classItem.class_room || ''}`.trim() || 'N/A'
            
            // Format blocks
            const blocksDisplay = classItem.blocks ? classItem.blocks.join(', ') : 'N/A'
            
            // Class color
            const classColor = classItem.class_color || '#0077FF'
            
            // Build class card
            container.innerHTML += `
                <div class="class-card">
                    <div class="class-color-bar" style="background-color: ${classColor};"></div>
                    <div class="class-content">
                        <div class="class-subject">${classItem.subject || 'N/A'}</div>
                        
                        <div class="class-details-row">
                            <div class="class-detail-half"><strong>Class Code:</strong> ${classItem.id}</div>
                            <div class="class-detail-half"><strong>Teacher:</strong> ${teacherName}</div>
                        </div>
                        
                        <div class="class-details-row">
                            <div class="class-detail-half"><strong>Class Level:</strong> ${classItem.class_level || 'N/A'}</div>
                            <div class="class-detail-half"><strong>Email:</strong> ${teacherEmail || 'N/A'}</div>
                        </div>
                        
                        <div class="class-details-row">
                            <div class="class-detail-half"><strong>Class Block:</strong> ${blocksDisplay}</div>
                            <div class="class-detail-half"><strong>Number:</strong> ${teacherPhone || 'N/A'}</div>
                        </div>
                        
                        <div class="class-detail-full"><strong>Class Day:</strong> ${daysDisplay}</div>
                        <div class="class-detail-full"><strong>Class Time:</strong> ${formatTime(classItem.class_time_start)} - ${formatTime(classItem.class_time_end)}</div>
                        <div class="class-detail-full"><strong>Class Loc:</strong> ${location}</div>
                        
                        
                        <button class="enter-class-btn" onclick="goToClass('${classItem.id}', '${classItem.subject}')">Enter Class</button>
                    </div>
                </div>
            `
        }
    } catch (error) {
        console.error('Error:', error)
        container.innerHTML = '<div class="loading">Error loading classes</div>'
    }
}

document.getElementById('showAttendanceSummaryBtn').addEventListener('click', showAttendanceSummary)

// Show Attendance Summary Modal
// Show Attendance Summary Modal
async function showAttendanceSummary() {
    const contentDiv = document.getElementById('attendanceSummaryContent')
    contentDiv.innerHTML = 'Loading...'
    showModal('attendanceSummaryModal')
    
    try {
        // Get minimum attendance rate from system settings
        let minRate = 75
        
        try {
            const { data: settings } = await supabase
                .from('system_settings')
                .select('minimum_attendance_rate')
                .eq('id', 1)
                .single()
            
            if (settings && settings.minimum_attendance_rate) {
                minRate = settings.minimum_attendance_rate
            }
        } catch (error) {
            console.log('Using default min rate: 75%')
        }
        
        // Get enrollments
        const { data: enrollments } = await supabase
            .from('class_list')
            .select('class_id')
            .eq('student_id', parseInt(userId))
        
        if (!enrollments || enrollments.length === 0) {
            contentDiv.innerHTML = '<div style="text-align: center; padding: 15px;">No classes enrolled</div>'
            return
        }
        
        const classIds = enrollments.map(e => e.class_id)
        
        // Get class details
        const { data: classes } = await supabase
            .from('classes')
            .select('*')
            .in('id', classIds)
        
        // Get sessions
        const { data: sessions } = await supabase
            .from('sessions')
            .select('id, class_id')
            .in('class_id', classIds)
        
        if (!sessions || sessions.length === 0) {
            contentDiv.innerHTML = '<div style="text-align: center; padding: 15px;">No sessions yet</div>'
            return
        }
        
        const sessionIds = sessions.map(s => s.id)
        
        // Get attendance
        const { data: attendances } = await supabase
            .from('attendances')
            .select('session_id, status')
            .in('session_id', sessionIds)
            .eq('student_id', parseInt(userId))
        
        const attendanceMap = {}
        if (attendances) {
            attendances.forEach(a => {
                attendanceMap[a.session_id] = a.status
            })
        }
        
        // Group by class
        const sessionsByClass = {}
        sessions.forEach(session => {
            if (!sessionsByClass[session.class_id]) {
                sessionsByClass[session.class_id] = []
            }
            sessionsByClass[session.class_id].push(session.id)
        })
        
        let summaryHtml = ''
        
        for (const classItem of classes) {
            const classSessions = sessionsByClass[classItem.id] || []
            const totalSessions = classSessions.length
            
            let present = 0, late = 0, absent = 0
            
            classSessions.forEach(sessionId => {
                const status = attendanceMap[sessionId]
                if (status === 'present') present++
                else if (status === 'late') late++
                else absent++
            })
            
            const attended = present + late
            const rate = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0
            
            // Calculate sessions per week for max absences
            const sessionsPerWeek = classItem.class_day ? classItem.class_day.length : 2
            const maxAbsences = sessionsPerWeek === 1 ? 3 : 6
            
            // Only show rate warning if below minimum rate
            let rateWarningHtml = ''
            if (rate < minRate && totalSessions > 0) {
                rateWarningHtml = `
                    <div style="margin-top: 5px; font-size: 11px; color: red; font-weight: bold;">
                        Warning: Below ${minRate}% attendance requirement (${rate}%)
                    </div>
                `
            }
            
            summaryHtml += `
                <div class="summary-class-item">
                    <div class="summary-class-subject">${classItem.subject}</div>
                    <div class="summary-class-stats">
                        <span class="summary-stat summary-stat-present">Present: ${present}</span>
                        <span class="summary-stat summary-stat-late">Late: ${late}</span>
                        <span class="summary-stat summary-stat-absent">Absent: ${absent} / ${maxAbsences} max</span>
                        <span class="summary-stat summary-stat-total">Total: ${totalSessions}</span>
                    </div>
                    ${rateWarningHtml}
                </div>
            `
        }
        
        contentDiv.innerHTML = summaryHtml || '<div style="text-align: center; padding: 15px;">No data</div>'
        
    } catch (error) {
        console.error('Error:', error)
        contentDiv.innerHTML = '<div style="text-align: center; padding: 15px; color: red;">Error loading summary</div>'
    }
}

// Enter Clicked Class
window.goToClass = (classId, className) => {
    // Store selected class info
    sessionStorage.setItem('selectedClassId', classId)
    sessionStorage.setItem('selectedClassName', className)
    window.location.href = 'studentClassDetail.html'
}

// Initialize
loadStudentClasses()