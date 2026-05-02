import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'


// Supabase connection
const supabaseUrl = 'https://bkxtmevrfpfhwrwildpx.supabase.co'
const supabaseAnonKey = 'sb_publishable_zkt89flZIVC5aEtgR7eOLQ_y20L9oGY'
const supabase = createClient(supabaseUrl, supabaseAnonKey)


let lateThresholdMinutes = 30


// Show Message (Success, Error, Info)
function showMessage(message, type = 'info') {
    // Remove any existing message first
    const existingMsg = document.querySelector('.floating-message')
    if (existingMsg) existingMsg.remove()
    
    // Create message element
    const msg = document.createElement('div')
    msg.className = `floating-message ${type}`
    msg.textContent = message
    document.body.appendChild(msg)
    
    // Auto remove after 2 seconds
    setTimeout(() => msg.remove(), 2000)
}

// Shortcuts
function showSuccess(msg) { showMessage(msg, 'success') }
function showError(msg) { showMessage(msg, 'error') }
function showInfo(msg) { showMessage(msg, 'info') }

// Custom confirm dialog
function showConfirm(message, itemName, onConfirm) {
    // Remove any existing confirm modal
    const existingConfirm = document.querySelector('.custom-confirm')
    if (existingConfirm) existingConfirm.remove()
    
    // Create confirm modal
    const confirmBox = document.createElement('div')
    confirmBox.className = 'custom-confirm'
    confirmBox.innerHTML = `
        <div class="confirm-content" style="max-width: 425px;">
            <p>${message} <strong>${itemName}</strong>?</p>
            <div class="confirm-buttons">
                <button class="confirm-no">Cancel</button>
                <button class="confirm-yes">Delete</button>
            </div>
        </div>
    `
    document.body.appendChild(confirmBox)
    
    // Handle button clicks
    confirmBox.querySelector('.confirm-yes').onclick = () => {
        confirmBox.remove()
        onConfirm()
    }
    confirmBox.querySelector('.confirm-no').onclick = () => confirmBox.remove()
}

// Get class info from session
const classId = sessionStorage.getItem('selectedClassId')
const className = sessionStorage.getItem('selectedClassName')
const teacherName = sessionStorage.getItem('userName')
const teacherId = sessionStorage.getItem('userId')
const userRole = sessionStorage.getItem('userRole')

if (!teacherId || userRole !== 'teacher') {
    window.location.href = 'login.html'
}

document.getElementById('teacherName').textContent = teacherName || 'Teacher'
document.getElementById('className').textContent = className || 'Class Details'


document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'teacherClassList.html'
})

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.clear()
    window.location.href = 'login.html'
})

let classData = null
let students = []
let sessions = []
let currentSessionDate = null
let video = null
let canvas = null
let scanning = false
let animationId = null
let processingScan = false

// Modal functions
window.showModal = (id) => document.getElementById(id).style.display = 'flex'
window.closeModal = (id) => document.getElementById(id).style.display = 'none'

// Load class details
async function loadClassDetails() {
    const { data } = await supabase
        .from('classes')
        .select('*')
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
        
        document.getElementById('className').textContent = data.subject || 'N/A'
        document.getElementById('classCode').textContent = data.id
        document.getElementById('classLevel').textContent = data.class_level || 'N/A'
        document.getElementById('classBlock').textContent = blocksDisplay
        document.getElementById('classDay').textContent = daysDisplay
        document.getElementById('classTime').textContent = `${formatTime(data.class_time_start)} - ${formatTime(data.class_time_end)}`
        document.getElementById('classLoc').textContent = location
    }
}

// Populate date dropdowns
function populateDateDropdowns() {
    const yearSelect = document.getElementById('sessionYear')
    const monthSelect = document.getElementById('sessionMonth')
    const daySelect = document.getElementById('sessionDay')
    
    const currentYear = new Date().getFullYear()
    for (let y = currentYear - 1; y <= currentYear + 2; y++) {
        yearSelect.innerHTML += `<option value="${y}">${y}</option>`
    }
    yearSelect.value = currentYear
    
    const months = ['01','02','03','04','05','06','07','08','09','10','11','12']
    months.forEach(m => monthSelect.innerHTML += `<option value="${m}">${m}</option>`)
    monthSelect.value = String(new Date().getMonth() + 1).padStart(2,'0')
    
    for (let d = 1; d <= 31; d++) {
        daySelect.innerHTML += `<option value="${String(d).padStart(2,'0')}">${d}</option>`
    }
    daySelect.value = String(new Date().getDate()).padStart(2,'0')
}

// Load students
async function loadStudents() {
    const { data } = await supabase
        .from('class_list')
        .select('student_id, users(id, name)')
        .eq('class_id', parseInt(classId))
        .order('student_id')
    
    if (data) {
        students = data.map(s => ({ id: s.users.id, name: s.users.name }))
    }
}

// Load sessions
async function loadSessions() {
    const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('class_id', parseInt(classId))
        .order('session_date', { ascending: true })
    
    if (data) sessions = data
}

// Render matrix table
async function renderMatrix() {
    if (!students.length) return
    
    await loadSessions()
    
    const dates = sessions.map(s => s.session_date)
    
    const thead = document.getElementById('tableHeader')
    const tbody = document.getElementById('tableBody')
    
    if (dates.length === 0) {
        thead.innerHTML = '<tr><th>Student</th></tr>'
        tbody.innerHTML = '<tr><td colspan="10">No sessions created yet. Create a session above!</td></tr>'
        return
    }
    
    const sessionIds = sessions.map(s => s.id)
    const { data: allAttendance } = await supabase
        .from('attendances')
        .select('session_id, student_id, status')
        .in('session_id', sessionIds)
    
    // Create a map for quick lookup
    const attendanceMap = {}
    if (allAttendance) {
        allAttendance.forEach(record => {
            const key = `${record.session_id}_${record.student_id}`
            attendanceMap[key] = record.status
        })
    }
    
    // Build header
    let headerHtml = '<tr><th>Student</th>'
    for (const date of dates) {
        headerHtml += `<th>
            ${date}<br>
            <div class="session-buttons">
                <button class="btn-qr" onclick="showQRForDate('${date}')">QR</button>
                <button class="btn-scan" onclick="openScannerForDate('${date}')">SCAN</button>
                <button class="btn-edit-session" onclick="openSessionEditModal('${date}')">EDIT</button>
            </div>
        </th>`
    }
    headerHtml += '</tr>'
    thead.innerHTML = headerHtml
    
    // Build body 
    tbody.innerHTML = ''
    for (const student of students) {
        let rowHtml = `<tr><td class="student-name">${student.name}</td>`
        
        for (const date of dates) {
            const session = sessions.find(s => s.session_date === date)
            let status = 'A'
            let statusClass = 'status-a'
            
            if (session) {
                const key = `${session.id}_${student.id}`
                const recordStatus = attendanceMap[key]
                
                if (recordStatus) {
                    status = recordStatus === 'present' ? 'P' : (recordStatus === 'late' ? 'L' : 'A')
                    statusClass = status === 'P' ? 'status-p' : (status === 'L' ? 'status-l' : 'status-a')
                }
            }
            
            rowHtml += `<td class="${statusClass}" onclick="editStatus('${date}', ${student.id}, '${status}')">${status}</td>`
        }
        rowHtml += '</tr>'
        tbody.innerHTML += rowHtml
    }
    console.log(`Matrix rendered: ${students.length} students, ${dates.length} dates (optimized - 1 attendance query)`)
}

// Create session
async function createSessionOnly(date) {
    let session = sessions.find(s => s.session_date === date)
    
    if (session) {
        showError('Session already exists for this date!')
        return null
    }
    
    const sessionId = `SESSION_${classId}_${date.replace(/-/g, '')}`
    const qrToken = sessionId
    
    const { data, error } = await supabase
        .from('sessions')
        .insert({
            id: sessionId,
            class_id: parseInt(classId),
            session_date: date,
            qr_token: qrToken
        })
        .select()
    
    if (error) {
        showError('Error creating session: ' + error.message)
        return null
    }
    
    session = data[0]
    sessions.push(session)
    
    // Create attendance records for all students (default 'absent')
    if (students.length > 0) {
        const attendanceRecords = students.map(student => ({
            session_id: session.id,
            student_id: student.id,
            status: 'absent',
            scan_time: null
        }))
        
        await supabase.from('attendances').insert(attendanceRecords)
        console.log(`Created ${attendanceRecords.length} absent records for session ${date}`)
    }
    
    await renderMatrix()
    return session
}


// Show QR
window.showQRForDate = async (date) => {
    currentSessionDate = date
    document.getElementById('qrDate').textContent = date
    
    let session = sessions.find(s => s.session_date === date)
    
    if (!session) {
        showError('No session found for this date. Create a session first.')
        return
    }
    
    const qrDisplay = document.getElementById('qrCodeDisplay')
    qrDisplay.innerHTML = ''
    
    const QRCodeLib = await loadQRCodeLibrary()
    const canvas = document.createElement('canvas')
    QRCodeLib.toCanvas(canvas, session.qr_token, { width: 260, margin: 1 })
    qrDisplay.appendChild(canvas)
    
    window.currentQRToken = session.qr_token
    showModal('qrModal')
}

// Load QR library
async function loadQRCodeLibrary() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js'
        script.onload = () => resolve(window.QRCode)
        script.onerror = () => reject(new Error('Failed to load QR'))
        document.head.appendChild(script)
    })
}

// Download QR
document.getElementById('downloadQrBtn').addEventListener('click', () => {
    const canvas = document.querySelector('#qrCodeDisplay canvas')
    if (canvas) {
        const link = document.createElement('a')
        link.download = `QR_${currentSessionDate}.png`
        link.href = canvas.toDataURL()
        link.click()
    }
})

// Open scanner for a specific date
window.openScannerForDate = async (date) => {
    currentSessionDate = date
    
    let session = sessions.find(s => s.session_date === date)
    if (!session) {
        await createSessionOnly(date)
        session = sessions.find(s => s.session_date === date)
    }
    
    if (session) {
        window.currentScanSession = session
        showModal('scannerModal')
        setTimeout(() => startScanner(), 500)
    }
}

// Start QR scanner using jsQR
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

// Check QR after scan
async function onScanSuccess(decodedText) {
    console.log("=== SCAN DEBUG ===")
    console.log("Scanned QR code:", decodedText)
    
    // Get the student from QR code
    const { data: student, error: studentError } = await supabase
        .from('users')
        .select('id, name')
        .eq('qr_value', decodedText)
        .eq('role', 'student')
        .single()
    
    if (!student || studentError) {
        document.getElementById('scanResult').innerHTML = `<span style="color: red; font-weight: bold;">Invalid student QR code</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 1500)
        return
    }
    
    // CHECK: Verify student is enrolled in THIS class
    const { data: enrollment, error: enrollmentError } = await supabase
        .from('class_list')
        .select('student_id')
        .eq('class_id', parseInt(classId))
        .eq('student_id', student.id)
        .single()
    
    if (!enrollment || enrollmentError) {
        document.getElementById('scanResult').innerHTML = `<span style="color: red; font-weight: bold;">${student.name} is not enrolled in this class</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 2000)
        return
    }
    
    // Get current session
    let session = sessions.find(s => s.session_date === currentSessionDate)
    if (!session) {
        await createSessionOnly(currentSessionDate)
        session = sessions.find(s => s.session_date === currentSessionDate)
    }
    
    if (!session) {
        document.getElementById('scanResult').innerHTML = `<span style="color: red; font-weight: bold;">No session found for ${currentSessionDate}</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 1500)
        return
    }
    
    // Check if already marked for this session
    const { data: existing } = await supabase
        .from('attendances')
        .select('status')
        .eq('session_id', session.id)
        .eq('student_id', student.id)
        .single()
    
    if (existing && existing.status !== 'absent') {
        document.getElementById('scanResult').innerHTML = `<span style="color: orange; font-weight: bold;">${student.name} already marked ${existing.status}</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 1500)
        return
    }
    
    const now = new Date()
    let hours = now.getHours()
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    const time = `${hours}:${minutes} ${ampm}`
    
    let status = 'present'
    if (classData && classData.class_time_start) {
        const classStart = classData.class_time_start
        let classHour = parseInt(classStart.split(':')[0])
        const classMinute = parseInt(classStart.split(':')[1])
        
        const currentHour24 = now.getHours()
        const currentTotalMinutes = currentHour24 * 60 + now.getMinutes()
        const classTotalMinutes = classHour * 60 + classMinute
        
        if (currentTotalMinutes > classTotalMinutes + lateThresholdMinutes) {
            status = 'late'
        }
    }
    
    const { error } = await supabase
        .from('attendances')
        .upsert({
            session_id: session.id,
            student_id: student.id,
            status: status,
            scan_time: time
        }, { onConflict: 'session_id,student_id' })
    
    if (!error) {
        document.getElementById('scanResult').innerHTML = `<span style="color: green; font-weight: bold;">${student.name} marked ${status}!</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 1500)
        await renderMatrix()
    } else {
        document.getElementById('scanResult').innerHTML = `<span style="color: red; font-weight: bold;">Error marking attendance</span>`
        setTimeout(() => {
            document.getElementById('scanResult').innerHTML = ''
        }, 1500)
    }
    
    console.log("=== END SCAN DEBUG ===")
}

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

// Edit status
// Variables to store edit status data
let editStatusData = {
    date: null,
    studentId: null,
    currentStatus: null,
    studentName: null
}

// Open custom edit status modal
window.editStatus = (date, studentId, currentStatus) => {
    // Find student name
    const student = students.find(s => s.id === studentId)
    
    // Store data
    editStatusData = {
        date: date,
        studentId: studentId,
        currentStatus: currentStatus,
        studentName: student ? student.name : 'Unknown'
    }
    
    // Update modal content
    document.getElementById('editStudentName').textContent = editStatusData.studentName
    document.getElementById('editSessionDate').textContent = date
    document.getElementById('editCurrentStatus').textContent = currentStatus === 'P' ? 'Present' : (currentStatus === 'L' ? 'Late' : 'Absent')
    
    // Show modal
    showModal('editStatusModal')
}

// Close edit status modal
window.closeEditStatusModal = () => {
    closeModal('editStatusModal')
}

// Save edited status
async function saveEditStatus(newStatusCode) {
    const { date, studentId, currentStatus } = editStatusData
    
    if (newStatusCode === currentStatus) {
        closeEditStatusModal()
        return
    }
    
    const statusMap = { 'P': 'present', 'L': 'late', 'A': 'absent' }
    const newStatus = statusMap[newStatusCode]
    
    let session = sessions.find(s => s.session_date === date)
    if (!session) {
        await createSessionOnly(date)
        session = sessions.find(s => s.session_date === date)
    }
    
    if (session) {
        const { error } = await supabase
            .from('attendances')
            .upsert({
                session_id: session.id,
                student_id: studentId,
                status: newStatus
            }, { onConflict: 'session_id,student_id' })
        
        if (!error) {
            showSuccess(`Status changed to ${newStatusCode === 'P' ? 'Present' : (newStatusCode === 'L' ? 'Late' : 'Absent')}`)
            await renderMatrix()
        } else {
            showError('Error updating status')
        }
    }
    
    closeEditStatusModal()
}

// Add event listeners for the buttons (call this in init or after DOM loads)
document.getElementById('editPresentBtn').addEventListener('click', () => saveEditStatus('P'))
document.getElementById('editLateBtn').addEventListener('click', () => saveEditStatus('L'))
document.getElementById('editAbsentBtn').addEventListener('click', () => saveEditStatus('A'))

// Create new session (without showing QR)
document.getElementById('createSessionBtn').addEventListener('click', async () => {
    const year = document.getElementById('sessionYear').value
    const month = document.getElementById('sessionMonth').value
    const day = document.getElementById('sessionDay').value
    const date = `${year}-${month}-${day}`
    
    await createSessionOnly(date)
})





// Variables for edit session
let currentEditSessionDate = null
let currentEditSession = null

// Open edit session modal
window.openSessionEditModal = (date) => {
    currentEditSessionDate = date
    currentEditSession = sessions.find(s => s.session_date === date)
    document.getElementById('editSessionDateDisplay').textContent = date
    showModal('editSessionModal')
}

// Close edit session modal
window.closeEditSessionModal = () => {
    closeModal('editSessionModal')
}

// Bulk update status for all students in a session
window.bulkUpdateStatus = async (newStatus) => {
    if (!currentEditSession) {
        showError('Session not found')
        return
    }
    
    let statusDisplay = newStatus === 'present' ? 'PRESENT' : (newStatus === 'late' ? 'LATE' : 'ABSENT')
    
    const attendanceRecords = students.map(student => ({
        session_id: currentEditSession.id,
        student_id: student.id,
        status: newStatus,
        scan_time: null
    }))
    
    const { error: deleteError } = await supabase
        .from('attendances')
        .delete()
        .eq('session_id', currentEditSession.id)
    
    if (deleteError) {
        showError('Error deleting existing records: ' + deleteError.message)
        return
    }
    
    const { error: insertError } = await supabase
        .from('attendances')
        .insert(attendanceRecords)
    
    if (insertError) {
        showError('Error updating status: ' + insertError.message)
    } else {
        showSuccess(`All students marked as ${statusDisplay}!`)
        closeEditSessionModal()
        await renderMatrix()
    }
}

// Confirm delete session
window.confirmDeleteSession = async () => {
    showConfirm('WARNING! This will delete the ENTIRE session and ALL attendance records. This cannot be undone.', currentEditSessionDate, async () => {
        if (!currentEditSession) {
            showError('Session not found')
            return
        }
        
        await supabase
            .from('attendances')
            .delete()
            .eq('session_id', currentEditSession.id)
        
        const { error } = await supabase
            .from('sessions')
            .delete()
            .eq('id', currentEditSession.id)
        
        if (error) {
            showError('Error deleting session: ' + error.message)
        } else {
            showSuccess(`Session for ${currentEditSessionDate} deleted!`)
            closeEditSessionModal()
            sessions = sessions.filter(s => s.id !== currentEditSession.id)
            await renderMatrix()
        }
    })
}


// Update attendance summary
async function updateAttendanceSummary() {
    if (students.length === 0 || sessions.length === 0) {
        document.getElementById('attendanceSummary').style.display = 'none'
        return
    }
    
    document.getElementById('attendanceSummary').style.display = 'block'
    document.getElementById('totalStudents').textContent = students.length
    document.getElementById('totalSessions').textContent = sessions.length
    
    // Get all attendance records
    const sessionIds = sessions.map(s => s.id)
    const { data: allAttendance } = await supabase
        .from('attendances')
        .select('session_id, student_id, status')
        .in('session_id', sessionIds)
    
    let totalPresent = 0
    let totalLate = 0
    let totalAbsent = 0
    
    if (allAttendance) {
        allAttendance.forEach(record => {
            if (record.status === 'present') totalPresent++
            else if (record.status === 'late') totalLate++
            else if (record.status === 'absent') totalAbsent++
        })
    }
    
    const totalRecords = totalPresent + totalLate + totalAbsent
    const attendanceRate = totalRecords > 0 ? Math.round((totalPresent + totalLate) / totalRecords * 100) : 0
    
    document.getElementById('totalPresent').textContent = totalPresent
    document.getElementById('totalLate').textContent = totalLate
    document.getElementById('totalAbsent').textContent = totalAbsent
    document.getElementById('attendanceRate').textContent = `${attendanceRate}%`
}

// Download all attendance records as CSV
async function downloadAllAttendance() {
    if (students.length === 0) {
        showError('No students found in this class')
        return
    }
    
    if (sessions.length === 0) {
        showError('No sessions found. Create sessions first.')
        return
    }
    
    try {
        // Get all session IDs
        const sessionIds = sessions.map(s => s.id)
        
        // Get all attendance records
        const { data: allAttendance } = await supabase
            .from('attendances')
            .select('session_id, student_id, status, scan_time')
            .in('session_id', sessionIds)
        
        // Create a map for quick lookup: sessionId_studentId -> status, scan_time
        const attendanceMap = {}
        if (allAttendance) {
            allAttendance.forEach(record => {
                const key = `${record.session_id}_${record.student_id}`
                attendanceMap[key] = {
                    status: record.status === 'present' ? 'P' : (record.status === 'late' ? 'L' : 'A'),
                    scan_time: record.scan_time || ''
                }
            })
        }
        
        // Prepare CSV data
        const csvRows = []
        
        // Header row
        const headers = ['Student ID', 'Student Name']
        for (const session of sessions) {
            headers.push(`${session.session_date}`)
        }
        csvRows.push(headers.join(','))
        
        // Data rows for each student
        for (const student of students) {
            const row = [student.id, student.name]
            
            for (const session of sessions) {
                const key = `${session.id}_${student.id}`
                const attendance = attendanceMap[key]
                const status = attendance ? attendance.status : 'A'
                row.push(status)
            }
            csvRows.push(row.join(','))
        }
        
        // Download CSV file
        const csvContent = csvRows.join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.href = url
        link.setAttribute('download', `attendance_${classId}_${new Date().toISOString().slice(0,19)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        showSuccess(`Downloaded attendance for ${students.length} students and ${sessions.length} sessions!`)
    } catch (error) {
        console.error('Error downloading attendance:', error)
        showError('Error downloading attendance')
    }
}

























async function loadLateThreshold() {
    const { data } = await supabase
        .from('system_settings')
        .select('late_threshold_minutes')
        .eq('id', 1)
        .single()
    
    if (data) {
        lateThresholdMinutes = data.late_threshold_minutes
    }
}























// Initialize
async function init() {
    populateDateDropdowns()
    await loadClassDetails()
    await loadStudents()
    await renderMatrix()
    await loadLateThreshold()
    await updateAttendanceSummary()

}

document.getElementById('downloadAttendanceBtn').addEventListener('click', downloadAllAttendance)

init()