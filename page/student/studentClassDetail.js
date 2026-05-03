import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://bkxtmevrfpfhwrwildpx.supabase.co'
const supabaseAnonKey = 'sb_publishable_zkt89flZIVC5aEtgR7eOLQ_y20L9oGY'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Get class info from sessionStorage
const classId = sessionStorage.getItem('selectedClassId')
const className = sessionStorage.getItem('selectedClassName')
const studentName = sessionStorage.getItem('userName')
const studentId = sessionStorage.getItem('userId')
const userRole = sessionStorage.getItem('userRole')

// Verify login
if (!studentId || userRole !== 'student') {
    window.location.href = '/page/login/login.html'
}

document.getElementById('studentName').textContent = studentName || 'Student'
document.getElementById('className').textContent = className || 'Class Details'

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'studentClassList.html'
})

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.clear()
    window.location.href = '/page/login/login.html'
})

let classData = null
let sessions = []
let video = null
let canvas = null
let scanning = false
let animationId = null
let processingScan = false

// Modal functions
window.showModal = (id) => document.getElementById(id).style.display = 'flex'
window.closeModal = (id) => document.getElementById(id).style.display = 'none'

// Format display time 
function formatDisplayTime(timeString) {
    if (!timeString) return '-'
    
    let hours, minutes
    
    if (timeString.includes(':')) {
        const parts = timeString.split(':')
        hours = parseInt(parts[0], 10)
        minutes = parts[1]
    } else {
        return timeString
    }
    
    const ampm = hours >= 12 ? 'PM' : 'AM'
    let displayHours = hours % 12 || 12
    return `${displayHours}:${minutes} ${ampm}`
}

// Load class details
async function loadClassDetails() {
    const { data } = await supabase
        .from('classes')
        .select('*, users!teacher_id(name)')
        .eq('id', parseInt(classId))
        .single()
    
    if (data) {
        classData = data
        
        const daysMap = { 'M': 'Mon', 'T': 'Tue', 'W': 'Wed', 'Th': 'Thu', 'F': 'Fri', 'S': 'Sat' }
        const daysDisplay = data.class_day?.map(d => daysMap[d] || d).join(', ') || 'N/A'
        
        const formatTime = (t) => {
            if (!t) return 'N/A'
            const [hour, minute] = t.split(':')
            let h = parseInt(hour, 10)
            const ampm = h >= 12 ? 'PM' : 'AM'
            h = h % 12 || 12
            return `${h}:${minute} ${ampm}`
        }
        
        const location = `${data.class_building || ''} ${data.class_room || ''}`.trim() || 'N/A'
        const blocksDisplay = data.blocks ? data.blocks.join(', ') : 'N/A'
        const teacherName = data.users?.name || 'Not assigned'
        
        document.getElementById('className').textContent = data.subject || 'N/A'
        document.getElementById('classCode').textContent = data.id
        document.getElementById('classTeacher').textContent = teacherName
        document.getElementById('classLevel').textContent = data.class_level || 'N/A'
        document.getElementById('classBlock').textContent = blocksDisplay
        document.getElementById('classDay').textContent = daysDisplay
        document.getElementById('classTime').textContent = `${formatTime(data.class_time_start)} - ${formatTime(data.class_time_end)}`
        document.getElementById('classLoc').textContent = location
    }
}

// Load attendance history for this student
async function loadAttendanceHistory() {
    const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .eq('class_id', parseInt(classId))
        .order('session_date', { ascending: false })
    
    if (!sessionsData || sessionsData.length === 0) {
        document.getElementById('attendanceBody').innerHTML = '<tr><td colspan="3">No sessions yet<\/td><\/tr>'
        return
    }
    
    sessions = sessionsData
    const sessionIds = sessions.map(s => s.id)
    
    const { data: attendanceData } = await supabase
        .from('attendances')
        .select('*')
        .in('session_id', sessionIds)
        .eq('student_id', parseInt(studentId))
    
    const attendanceMap = {}
    if (attendanceData) {
        attendanceData.forEach(record => {
            attendanceMap[record.session_id] = record
        })
    }
    
    const tbody = document.getElementById('attendanceBody')
    tbody.innerHTML = ''
    
    for (const session of sessions) {
        const attendance = attendanceMap[session.id]
        let status = 'Absent'
        let statusClass = 'status-absent'
        let scanTime = '-'
        
        if (attendance) {
            if (attendance.status === 'present') {
                status = 'Present'
                statusClass = 'status-present'
            } else if (attendance.status === 'late') {
                status = 'Late'
                statusClass = 'status-late'
            }
            // Format the scan time using formatDisplayTime
            scanTime = attendance.scan_time ? formatDisplayTime(attendance.scan_time) : '-'
        }
        
        tbody.innerHTML += `
            <tr>
                <td>${session.session_date}<\/td>
                <td class="${statusClass}">${status}<\/td>
                <td>${scanTime}<\/td>
            </tr>
        `
    }
}

// Scanner functions
function startScanner() {
    video = document.getElementById('video')
    canvas = document.getElementById('canvas')
    
    if (!video) return
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
            video.srcObject = stream
            video.play()
            scanning = true
            scanQRCode()
        })
        .catch(err => {
            console.error("Camera error:", err)
            document.getElementById('scanResult').innerHTML = `<span style="color: red; font-weight: bold;">Camera error: ${err.message}</span>`
            
        })
}

async function scanQRCode() {
    if (!scanning) return
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        
        if (typeof jsQR !== 'undefined') {
            const code = jsQR(imageData.data, canvas.width, canvas.height)
            if (code && !processingScan) {
                processingScan = true
                await onScanSuccess(code.data)
                processingScan = false
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }
    }
    animationId = requestAnimationFrame(scanQRCode)
}

async function onScanSuccess(decodedText) {
    console.log("=== SCAN DEBUG ===")
    console.log("Scanned QR code:", decodedText)
    
    // Make sure classData is loaded
    if (!classData) {
        document.getElementById('scanResult').innerHTML = `<span style="color: red; font-weight: bold;">Class data not loaded yet. Please refresh.</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 1500)
        return
    }
    
    // Find the session with matching QR token
    const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('qr_token', decodedText)
        .single()
    
    console.log("Session found:", session)
    
    if (!session || sessionError) {
        document.getElementById('scanResult').innerHTML = `<span style="color: red; font-weight: bold;">Invalid session QR code</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 1500)
        return
    }
    
    // Verify this session belongs to THIS class
    if (session.class_id !== parseInt(classId)) {
        document.getElementById('scanResult').innerHTML = `<span style="color: red; font-weight: bold;">This QR code is for ${session.session_date}. You can only scan for today (${todayStr})</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 1500)
        return
    }
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    console.log("Session date:", session.session_date)
    console.log("Today's date:", todayStr)
    
    // CHECK: Can only scan sessions for TODAY's date
    if (session.session_date !== todayStr) {
        document.getElementById('scanResult').innerHTML = `<span style="color: red; font-weight: bold;">This QR code is for ${session.session_date}. You can only scan for today (${todayStr})</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 3000)
        return
    }
    
    // Get current time
    const now = new Date()
    const currentHour24 = now.getHours()
    const currentMinutes = now.getMinutes()
    const currentTotalMinutes = currentHour24 * 60 + currentMinutes
    
    // Parse class START time (from classData)
    const classStart = classData.class_time_start
    console.log("Raw class_start value:", classStart)
    
    let classStartHour, classStartMinute, classStartTotalMinutes
    
    // Handle both "format
    if (classStart.includes(':')) {
        const parts = classStart.split(':')
        classStartHour = parseInt(parts[0], 10)
        classStartMinute = parseInt(parts[1], 10)
        
        // If hour is less than 12 and it's PM in the string, add 12
        // But since it's stored in 24-hour format in DB, just use as is
        classStartTotalMinutes = classStartHour * 60 + classStartMinute
    } else {
        classStartTotalMinutes = 0
    }
    
    // Parse class END time
    const classEnd = classData.class_time_end
    
    let classEndHour, classEndMinute, classEndTotalMinutes
    if (classEnd.includes(':')) {
        const parts = classEnd.split(':')
        classEndHour = parseInt(parts[0], 10)
        classEndMinute = parseInt(parts[1], 10)
        classEndTotalMinutes = classEndHour * 60 + classEndMinute
    } else {
        classEndTotalMinutes = 0
    }
    
    // CHECK: Can only scan BEFORE class ends
    if (currentTotalMinutes > classEndTotalMinutes) {
        let endHour = classEndHour % 12 || 12
        const endAmpm = classEndHour >= 12 ? 'PM' : 'AM'
        const endTimeStr = `${endHour}:${String(classEndMinute).padStart(2, '0')} ${endAmpm}`
        document.getElementById('scanResult').innerHTML = `<span style="color: red; font-weight: bold;">Class has already ended at ${endTimeStr}. You can no longer mark attendance.</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 3000)
        return
    }
    
    // Check if already marked for this session
    const { data: existing } = await supabase
        .from('attendances')
        .select('status')
        .eq('session_id', session.id)
        .eq('student_id', parseInt(studentId))
        .single()
    
    if (existing && existing.status !== 'absent') {
        document.getElementById('scanResult').innerHTML = `<span style="color: orange; font-weight: bold;">You already marked ${existing.status} for this session</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 1500)
        return
    }
    
    // Format time for display
    let displayHours = currentHour24 % 12 || 12
    const displayMinutes = currentMinutes.toString().padStart(2, '0')
    const ampm = currentHour24 >= 12 ? 'PM' : 'AM'
    const timeString = `${displayHours}:${displayMinutes} ${ampm}`
    
    // Determine status based on time
    let status = 'present'
    const lateThreshold = classStartTotalMinutes + 30
    console.log("Late threshold:", lateThreshold, "minutes")
    console.log("Current time:", currentTotalMinutes, "minutes")
    console.log("Is late?", currentTotalMinutes > lateThreshold)
    
    if (currentTotalMinutes > lateThreshold) {
        status = 'late'
        console.log("Marking as LATE")
    } else {
        console.log("Marking as PRESENT")
    }
    
    const { error } = await supabase
        .from('attendances')
        .upsert({
            session_id: session.id,
            student_id: parseInt(studentId),
            status: status,
            scan_time: timeString
        }, { onConflict: 'session_id,student_id' })
    
    if (!error) {
        document.getElementById('scanResult').innerHTML = `<span style="color: green; font-weight: bold;">Attendance marked: ${status.toUpperCase()} at ${timeString}!</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 1500)
        closeScanner()
        await loadAttendanceHistory()
    } else {
        document.getElementById('scanResult').innerHTML = `<span style="color: red; font-weight: bold;">Error marking attendance: ${error.message}</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 1500)
    }
    
}

// Close scanner
function closeScanner() {
    scanning = false
    if (animationId) {
        cancelAnimationFrame(animationId)
        animationId = null
    }
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop())
        video.srcObject = null
    }
    closeModal('scannerModal')
}

window.closeScanner = closeScanner

// Open scanner
document.getElementById('scanSessionBtn').addEventListener('click', () => {
    showModal('scannerModal')
    setTimeout(() => startScanner(), 500)
})

// Initialize
async function init() {
    await loadClassDetails()
    await loadAttendanceHistory()
}

init()