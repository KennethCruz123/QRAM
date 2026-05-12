import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// SUPABASE CONNECTION
const supabaseUrl = 'https://bkxtmevrfpfhwrwildpx.supabase.co'
const supabaseAnonKey = 'sb_publishable_zkt89flZIVC5aEtgR7eOLQ_y20L9oGY'
const supabase = createClient(supabaseUrl, supabaseAnonKey)



// AUDIT LOG FUNCTION 
async function logAction(action, details) {
    try {
        const userId = sessionStorage.getItem('userId')
        const userName = sessionStorage.getItem('userName') || 'Unknown'
        const userRole = sessionStorage.getItem('userRole') || 'unknown'
        
        await supabase
            .from('audit_logs')
            .insert({
                user_id: userId ? parseInt(userId) : null,
                user_name: userName,
                user_role: userRole,
                action: action,
                details: details
            })
    } catch (error) {
        console.error('Failed to log action:', error)
    }
}



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
        <div class="confirm-content">
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



// Display Admin name
const adminName = sessionStorage.getItem('userName')
document.getElementById('welcomeAdminName').textContent = adminName || 'Admin'

// Logout button
document.getElementById('logoutBtn').addEventListener('click', async () => {
    const userId = sessionStorage.getItem('userId')
    const userName = sessionStorage.getItem('userName')
    const userRole = sessionStorage.getItem('userRole')
    
    // Track logout for admin and super_admin
    if (userId && userName && (userRole === 'admin' || userRole === 'super_admin')) {
        await supabase.from('audit_logs').insert({
            user_id: parseInt(userId),
            user_name: userName,
            user_role: userRole,
            action: 'LOGOUT',
            details: `${userRole.toUpperCase()} ${userName} (ID: ${userId}) logged out`
        })
    }
    
    sessionStorage.clear()
    window.location.href = '/page/login/login.html'
})



// ========== MODAL FUNCTIONS ==========

// Shows Modals
window.showModal = (modalId) => {
    document.getElementById(modalId).style.display = 'flex'
}

// Close Modals and Ready the password 
window.closeModal = (modalId) => {
    document.getElementById(modalId).style.display = 'none';
    
    if (modalId === 'teacherModal') {
        document.getElementById('teacherPassword').value = '';
        document.getElementById('teacherPassword').placeholder = '******';
        resetTeacherForm();
    }
    if (modalId === 'studentModal') {
        document.getElementById('studentPassword').value = '';
        document.getElementById('studentPassword').placeholder = '******';
        resetStudentForm();
    }
    if (modalId === 'classModal') resetClassForm();
    if (modalId === 'adminModal') {
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').placeholder = '******';
        resetAdminForm();
    } 
}



// ========== GLOBAL VARIABLES ==========

// Null by default
let currentEditTeacherId = null
let currentEditStudentId = null
let currentEditClassId = null

let currentSelectedClassId = null
let currentSelectedClassName = null
let currentViewStudentId = null

// Filter and Sort Variables
let teacherSearchTerm = ''
let teacherSortBy = 'id_asc'

let studentSearchTerm = ''
let studentSortBy = 'id_asc'
let studentBlockFilter = 'all'
let studentLevelFilter = 'all'
let studentProgramFilter = 'all'

let classSearchTerm = ''
let classSortBy = 'code_asc'

// Modal Filter Variables
let modalStudentsList = []
let modalEnrolledIds = []
let modalSelectedLevels = []    
let modalSelectedBlocks = []     

// Pagination Variables
let currentTeacherPage = 1
let currentStudentPage = 1
let currentClassPage = 1

const itemsPerPage = 10

let allTeachers = []
let allStudents = []
let allClasses = []



// ========== HELPER FUNCTION ==========

// Generate QR code token
function generateQRValue(studentId) {
    return `STUDENT_${studentId}_${Math.random().toString(36).substring(2, 10)}`
}

// Format Time
function formatTime(time) {
    if (!time) return 'N/A';
    const [hour, minute] = time.split(':');
    const hour12 = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minute} ${ampm}`;
}

// Format days
function formatDays(days) {
    const daysMap = { 'M': 'Mon', 'T': 'Tue', 'W': 'Wed', 'Th': 'Thu', 'F': 'Fri', 'S': 'Sat' };
    return days?.map(d => daysMap[d] || d).join(', ') || 'N/A';
}

// Displays and Filters the Student List Inside the "Add Student to Class"
function renderModalStudentList() {
    let filteredStudents = [...modalStudentsList]
    
    // Apply level filter (if any levels selected)
    if (modalSelectedLevels.length > 0) {
        filteredStudents = filteredStudents.filter(student => 
            modalSelectedLevels.includes(student.level?.toString())
        )
    }
    
    // Apply block filter (if any blocks selected)
    if (modalSelectedBlocks.length > 0) {
        filteredStudents = filteredStudents.filter(student => 
            modalSelectedBlocks.includes(student.block)
        )
    }
    
    const studentsContainer = document.getElementById('studentsListContainer')
    if (!studentsContainer) return
    
    studentsContainer.innerHTML = filteredStudents.map(student => `
        <div class="student-list-item">
            <label class="checkbox-label">
                <input type="checkbox" value="${student.id}" ${modalEnrolledIds.includes(student.id) ? 'checked' : ''}>
                <span><strong>${student.id}</strong> - ${student.name} 
                </span>
            </label>
        </div>
    `).join('')
}



// clear all form fields and reset edit mode flags of Teacher
function resetTeacherForm() {
    document.getElementById('teacherId').disabled = false;
    document.getElementById('teacherId').value = '';
    document.getElementById('teacherName').value = '';
    document.getElementById('teacherEmail').value = '';
    document.getElementById('teacherPhone').value = '';
    document.getElementById('teacherPassword').value = '';
    currentEditTeacherId = null;
}

// clear all form fields and reset edit mode flags of Student
function resetStudentForm() {
    document.getElementById('studentId').disabled = false;
    document.getElementById('studentId').value = '';
    document.getElementById('studentName').value = '';
    document.getElementById('studentProgram').value = '';
    document.getElementById('studentLevel').value = '';
    document.getElementById('studentBlock').value = '';
    document.getElementById('studentEmail').value = '';
    document.getElementById('studentPhone').value = '';
    document.getElementById('studentPassword').value = '';
    currentEditStudentId = null;
}

// clear all form fields and reset edit mode flags of Class
function resetClassForm() {
    document.getElementById('classCode').disabled = false;
    document.getElementById('classCode').value = '';
    document.getElementById('classSubject').value = '';
    document.getElementById('classProgram').value = ''; 
    document.querySelectorAll('.blocks-checkbox input').forEach(cb => cb.checked = false);
    document.getElementById('classRoom').value = '';
    document.getElementById('classStartTime').value = '';
    document.getElementById('classEndTime').value = '';
    document.querySelectorAll('input[name="classLevel"]').forEach(radio => radio.checked = false);
    document.getElementById('classColor').value = 'orangered';
    document.querySelector('input[name="classBuilding"][value="Main"]').checked = true;
    document.querySelectorAll('.days-checkbox input').forEach(cb => cb.checked = false);
    currentEditClassId = null;
}



// ========== FILTER & SORT FUNCTIONS ==========

// Teachers filter and sort function
function getFilteredAndSortedTeachers() {

    // Make a copy of all Teachers
    let filteredTeachers = [...allTeachers]
    
    // Apply Searching Filter 
    if (teacherSearchTerm) {
        const searchLower = teacherSearchTerm.toLowerCase()

        // Assigned and Created New Filtered Teacher/s Array
        filteredTeachers = filteredTeachers.filter(teacher => 
            teacher.id.toString().includes(searchLower) ||
            (teacher.name && teacher.name.toLowerCase().includes(searchLower)) ||
            (teacher.email && teacher.email.toLowerCase().includes(searchLower))
        )
    }
    
    // Apply sorting Filter
    filteredTeachers.sort((a, b) => {
        switch(teacherSortBy) {
            case 'id_asc': return a.id - b.id
            case 'id_desc': return b.id - a.id
            case 'name_asc': return (a.name || '').localeCompare(b.name || '')
            case 'name_desc': return (b.name || '').localeCompare(a.name || '')
            default: return 0
        }
    })
    
    return filteredTeachers
}

// Students filter and sort function
function getFilteredAndSortedStudents() {

    // Make a copy of all Students
    let filteredStudents = [...allStudents]

    // Apply program filter
    if (studentProgramFilter !== 'all') {
        filteredStudents = filteredStudents.filter(student => 
            student.program === studentProgramFilter
        )
    }
    
    // Apply level filter
    if (studentLevelFilter !== 'all') {
        filteredStudents = filteredStudents.filter(student => 
            student.level && student.level.toString() === studentLevelFilter
        )
    }
    
    // Apply block filter
    if (studentBlockFilter !== 'all') {
        filteredStudents = filteredStudents.filter(student => 
            student.block === studentBlockFilter
        )
    }
    
    // Apply Searching Filter 
    if (studentSearchTerm) {
        const searchLower = studentSearchTerm.toLowerCase()
        
        // Assigned and Created New Filtered Student/s Array
        filteredStudents = filteredStudents.filter(student => 
            student.id.toString().includes(searchLower) ||
            (student.name && student.name.toLowerCase().includes(searchLower)) ||
            (student.level && student.level.toString().includes(searchLower)) || 
            (student.email && student.email.toLowerCase().includes(searchLower))
        )
    }
    
    // Apply sorting Filter
    filteredStudents.sort((a, b) => {
        switch(studentSortBy) {
            case 'id_asc': return a.id - b.id
            case 'id_desc': return b.id - a.id
            case 'name_asc': return (a.name || '').localeCompare(b.name || '')
            case 'name_desc': return (b.name || '').localeCompare(a.name || '')
            default: return 0
        }
    })
    
    return filteredStudents
}

// Classees filter and sort function
function getFilteredAndSortedClasses() {

    // Make a copy of all Classes
    let filteredClasses = [...allClasses]
    
    
    // Apply Searching Filter 
    if (classSearchTerm) {
        const searchLower = classSearchTerm.toLowerCase()
    
        // Assigned and Created New Filtered Class/es Array
        filteredClasses = filteredClasses.filter(classItem => 
            classItem.id.toString().includes(searchLower) ||
            (classItem.subject && classItem.subject.toLowerCase().includes(searchLower)) ||
            (classItem.teacherName && classItem.teacherName.toLowerCase().includes(searchLower)) ||
            (classItem.program && classItem.program.toLowerCase().includes(searchLower)) 
        )
    }
    
    // Apply sorting
    filteredClasses.sort((a, b) => {
        switch(classSortBy) {
            case 'code_asc': return a.id - b.id
            case 'code_desc': return b.id - a.id
            case 'subject_asc': return (a.subject || '').localeCompare(b.subject || '')
            case 'subject_desc': return (b.subject || '').localeCompare(a.subject || '')
            case 'students_asc': return (a.studentCount || 0) - (b.studentCount || 0)
            case 'students_desc': return (b.studentCount || 0) - (a.studentCount || 0)
            default: return 0
        }
    })
    
    return filteredClasses
}



// ========== LOAD & RENDER FUNCTIONS ==========

// Load Teachers
async function loadTeachers() {
    
    // Query database
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'teacher')
        .order('id')
    

    // If no Teacher where to put "No teacher found"
    const tbody = document.getElementById('teachersBody')
    const paginationDiv = document.getElementById('teachersPagination')
    
    // If no Teacher Found
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No teachers found<\/td><\/tr>'
        if (paginationDiv) paginationDiv.style.display = 'none'
        return
    }
    
    // Put all Teachers in Global Variable (For Filtering and Sorting)
    allTeachers = data

    // Reset to Fist page
    currentTeacherPage = 1

    // Show Pagination
    if (paginationDiv) paginationDiv.style.display = 'flex'
    renderTeacherPage()
}

// Render Teachers
function renderTeacherPage() {

    // If you're in this fucntion that means there is Teacher Found
    // Where to put them, Here
    const tbody = document.getElementById('teachersBody')
    
    // Get filtered and sorted teachers
    const filteredTeachers = getFilteredAndSortedTeachers() // Remember this FilteredAndSorted function
    
    // If the filtered has no result
    if (filteredTeachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No teachers found matching your search<\/td><\/tr>'
        const pageInfo = document.getElementById('teacherPageInfo')

        // Show "Page 0 of 0" since no result 
        if (pageInfo) pageInfo.textContent = `Page 0 of 0`
        return
    }
    
    // Calculate pagination based on filtered results
    const start = (currentTeacherPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    const pageTeachers = filteredTeachers.slice(start, end)
    
    // Clear existing rows before displaying
    tbody.innerHTML = ''
    
    // Display actual teachers
    pageTeachers.forEach(teacher => {
        tbody.innerHTML += `
            <tr>
                <td>${teacher.id}<\/td>
                <td>${teacher.name || 'N/A'}<\/td>
                <td>${teacher.email || 'N/A'}<\/td>
                <td>${teacher.phone || 'N/A'}<\/td>
                <td class="action-buttons">
                    <button class="btn-edit" onclick="editTeacher('${teacher.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteTeacher('${teacher.id}', '${teacher.name}')">Delete</button>
                <\/td>
            <\/tr>
        `
    })
    
    // Add empty rows to reach itemsPerPage (10 rows)
    const remainingRows = itemsPerPage - pageTeachers.length
    for (let i = 0; i < remainingRows; i++) {
        tbody.innerHTML += `
            <tr class="empty-row">
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
            <\/tr>
        `
    }
    
    // Calculate and display current page and total page
    const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage)
    const pageInfo = document.getElementById('teacherPageInfo')
    if (pageInfo) pageInfo.textContent = `Page ${currentTeacherPage} of ${totalPages}`
    
    // Enable/disable pagination buttons
    const prevBtn = document.querySelector('.prev-teacher')
    const nextBtn = document.querySelector('.next-teacher')
    if (prevBtn && nextBtn) {
        prevBtn.disabled = false
        nextBtn.disabled = false
        if (currentTeacherPage === 1) prevBtn.disabled = true
        if (currentTeacherPage === totalPages || totalPages === 0) nextBtn.disabled = true
    }
}

// Load Students
async function loadStudents() {

    // Query database
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('id')
    
    // If no Student where to put "No Student found"
    const tbody = document.getElementById('studentsBody')
    const paginationDiv = document.getElementById('studentsPagination')
    
    // If no Student Found
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No students found<\/td><\/tr>'
        if (paginationDiv) paginationDiv.style.display = 'none'
        return
    }
    
    // Put all Students in Global Variable (For Filtering and Sorting)
    allStudents = data

    // Reset to Fist page
    currentStudentPage = 1
        
    // Show Pagination
    if (paginationDiv) paginationDiv.style.display = 'flex'
    renderStudentPage()
}

// Render Students
function renderStudentPage() {

    // If you're in this fucntion that means there is Student Found
    // Where to put them, Here
    const tbody = document.getElementById('studentsBody')
    
    // Get filtered and sorted students
    const filteredStudents = getFilteredAndSortedStudents() // Remember this FilteredAndSorted function
    
    // If the filtered has no result
    if (filteredStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No students found matching your search or filter<\/td><\/tr>'
        const pageInfo = document.getElementById('studentPageInfo')

        // Show "Page 0 of 0" since no result 
        if (pageInfo) pageInfo.textContent = `Page 0 of 0`
        return
    }
    
    // Calculate pagination based on filtered results
    const start = (currentStudentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    const pageStudents = filteredStudents.slice(start, end)
    
    // Clear existing rows before displaying
    tbody.innerHTML = ''
    
    // Display actual students
    pageStudents.forEach(student => {
        tbody.innerHTML += `
            <tr>
                <td>${student.id}<\/td>
                <td>${student.name || 'N/A'}<\/td>
                <td>${student.program || 'N/A'}</td>
                <td>${student.level || 'N/A'}<\/td>
                <td>${student.block || 'N/A'}<\/td>
                <td>${student.email || 'N/A'}<\/td>
                <td>${student.phone || 'N/A'}<\/td>
                <td class="action-buttons">
                    <button class="btn-view" onclick="viewStudent('${student.id}')">View</button>
                    <button class="btn-edit" onclick="editStudent('${student.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteStudent('${student.id}', '${student.name}')">Delete</button>
                <\/td>
            <\/tr>
        `
    })
    
    // Add empty rows to reach itemsPerPage (10 rows)
    const remainingRows = itemsPerPage - pageStudents.length
    for (let i = 0; i < remainingRows; i++) {
        tbody.innerHTML += `
            <tr class="empty-row">
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
            <\/tr>
        `
    }
    
    // Calculate and display current page and total page
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
    const pageInfo = document.getElementById('studentPageInfo')
    if (pageInfo) pageInfo.textContent = `Page ${currentStudentPage} of ${totalPages}`
    
    // Enable/disable pagination buttons
    const prevBtn = document.querySelector('.prev-student')
    const nextBtn = document.querySelector('.next-student')
    if (prevBtn && nextBtn) {
        prevBtn.disabled = false
        nextBtn.disabled = false
        if (currentStudentPage === 1) prevBtn.disabled = true
        if (currentStudentPage === totalPages || totalPages === 0) nextBtn.disabled = true
    }
}

// Load Classes
async function loadClasses() {

    // Query database 
    // Get all classes with teacher names in ONE query using JOIN
    const { data: classesWithTeachers, error } = await supabase
        .from('classes')
        .select(`
            *,
            users!teacher_id (name)
        `)

    // If no Class where to put "No Class found"
    const tbody = document.getElementById('classesBody')
    const paginationDiv = document.getElementById('classesPagination')
    
    // If the filtered has no result
    if (error || !classesWithTeachers || classesWithTeachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No classes found<\/td><\/tr>'
        if (paginationDiv) paginationDiv.style.display = 'none'
        return
    }
    
    // Query database 
    // Get all student counts in ONE query
    const { data: enrollments } = await supabase
        .from('class_list')
        .select('class_id', { count: 'exact' })
    
    // Count students per class
    const studentCounts = {}
    if (enrollments) {
        enrollments.forEach(enrollment => {
            studentCounts[enrollment.class_id] = (studentCounts[enrollment.class_id] || 0) + 1
        })
    }
    
    // Process all classes 
    const processedClasses = classesWithTeachers.map(classItem => {
        const teacherName = classItem.users?.name || 'Not assigned'
        
        return {
            ...classItem,
            teacherName: teacherName,
            studentCount: studentCounts[classItem.id] || 0,
            blocksDisplay: classItem.blocks ? classItem.blocks.join(', ') : 'N/A',
            programDisplay: classItem.program || 'All Programs'
        }
    })
    
    // Put all Classes in Global Variable (For Filtering and Sorting)
    allClasses = processedClasses

    // Reset to Fist page
    currentClassPage = 1
    
    // Show Pagination
    if (paginationDiv) paginationDiv.style.display = 'flex'
    renderClassPage()
}

// Render Classes
function renderClassPage() {

    // If you're in this fucntion that means there is Class Found
    // Where to put them, Here
    const tbody = document.getElementById('classesBody')
    
    // Get filtered and sorted classes
    const filteredClasses = getFilteredAndSortedClasses() // Remember this FilteredAndSorted function
    
    // If the filtered has no result
    if (filteredClasses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No classes found matching your search<\/td><\/tr>'
        const pageInfo = document.getElementById('classPageInfo')
        if (pageInfo) pageInfo.textContent = `Page 0 of 0`
        return
    }
    
    // Calculate and display current page and total page
    const start = (currentClassPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    const pageClasses = filteredClasses.slice(start, end)
    
    // Clear existing rows before displaying
    tbody.innerHTML = ''
    
    // Display actual classes
    for (const classItem of pageClasses) {
        tbody.innerHTML += `
            <tr>
                <td>${classItem.id}<\/td>
                <td>${classItem.subject || 'N/A'}<\/td>
                <td>${classItem.programDisplay}</td> 
                <td>${classItem.class_level || 'N/A'}<\/td>
                <td>${classItem.blocksDisplay}<\/td>
                <td>${classItem.teacherName}<\/td>
                <td>${classItem.studentCount} students<\/td>
                <td class="action-buttons">
                    <button class="btn-view" onclick="viewClassStudents('${classItem.id}', '${classItem.subject}')">View</button>
                    <button class="btn-add-student" onclick="addStudentToClass('${classItem.id}', '${classItem.subject}')">+/- Student</button>
                    <button class="btn-edit" onclick="editClass('${classItem.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteClass('${classItem.id}', '${classItem.subject}')">Delete</button>
                <\/td>
            <\/tr>
        `
    }
    
    // Add empty rows to reach itemsPerPage (10 rows)
    const remainingRows = itemsPerPage - pageClasses.length
    for (let i = 0; i < remainingRows; i++) {
        tbody.innerHTML += `
            <tr class="empty-row">
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
                <td>&nbsp;</td>
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td> 
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
                <td>&nbsp;<\/td>
            <\/tr>
        `
    }
    
    // Calculate and display current page and total page
    const totalPages = Math.ceil(filteredClasses.length / itemsPerPage)
    const pageInfo = document.getElementById('classPageInfo')
    if (pageInfo) pageInfo.textContent = `Page ${currentClassPage} of ${totalPages}`
    
    // Enable/disable pagination buttons
    const prevBtn = document.querySelector('.prev-class')
    const nextBtn = document.querySelector('.next-class')
    if (prevBtn && nextBtn) {
        prevBtn.disabled = false
        nextBtn.disabled = false
        if (currentClassPage === 1) prevBtn.disabled = true
        if (currentClassPage === totalPages || totalPages === 0) nextBtn.disabled = true
    }
}



// ========== ADD/EDIT/DELETE/SAVE FUNCTIONS ==========



// ===== Teacher =====

// Open teacher modal in "Add" mode
document.getElementById('addTeacherBtn').onclick = () => {
    currentEditTeacherId = null;
    document.getElementById('teacherModalTitle').textContent = 'Add Teacher';
    document.getElementById('saveTeacherBtn').textContent = 'Create';
    document.getElementById('teacherId').disabled = false;
    document.getElementById('teacherId').value = '';
    document.getElementById('teacherName').value = '';
    document.getElementById('teacherEmail').value = '';
    document.getElementById('teacherPhone').value = '';
    document.getElementById('teacherPassword').value = '';
    document.getElementById('teacherPassword').placeholder = '******';
    showModal('teacherModal');
}

// Open teacher modal in "Edit" mode
window.editTeacher = async (id) => {
    
    // Store current Teacher ID
    currentEditTeacherId = id;

    // Query database
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
    
    // Ensures Teacher exists before trying to display data.
    if (data) {
        document.getElementById('teacherModalTitle').textContent = 'Edit Teacher';
        document.getElementById('saveTeacherBtn').textContent = 'Update';
        document.getElementById('teacherId').value = id;
        document.getElementById('teacherId').disabled = true;
        document.getElementById('teacherName').value = data.name || '';
        document.getElementById('teacherEmail').value = data.email || '';
        document.getElementById('teacherPhone').value = data.phone || '';
        document.getElementById('teacherPassword').value = '';
        document.getElementById('teacherPassword').placeholder = 'Leave blank to keep same';
        showModal('teacherModal');
    }
}

// Delete Teacher from database
window.deleteTeacher = async (id, name) => {
    showConfirm('Delete Teacher', name, async () => {
        await supabase.from('users').delete().eq('id', id)
        await loadTeachers()
        await updateStats()
        showSuccess(`Teacher "${name}" deleted`)
        await logAction('DELETE_TEACHER', `Deleted teacher: ${name} (ID: ${id})`)
    })
}

// Save Teacher (Add or Edit based on mode)
document.getElementById('saveTeacherBtn').onclick = async () => {
    
    //  Get Form Values
    const teacherId = parseInt(document.getElementById('teacherId').value)
    const name = document.getElementById('teacherName').value.trim()
    const email = document.getElementById('teacherEmail').value.trim()
    const phone = document.getElementById('teacherPhone').value.trim()
    const password = document.getElementById('teacherPassword').value
    
    // Validation
    if (!teacherId || !name || !email) {
        showError('Please fill all fields')
        return
    }
    
    // Query database
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', teacherId)
        .single()
    
    // Prevent Duplicate IDs (on Add only)
    if (existing && !currentEditTeacherId) {
        showError(`Teacher ID ${teacherId} already exists!`)
        
        return
    }
    
    // Check if we're in ADD mode (not editing)
    if (!currentEditTeacherId) {
        // New Teacher must have a password
        if (!password) {
            showError('Password is required for new teacher')
            return
        }
        
        // Add new row to database
        const { error } = await supabase.from('users').insert({
            id: teacherId, name, email, phone, password, role: 'teacher'
        })
        
        if (error) {
            showError("Error: " + error.message)
        } else {
            showSuccess('Teacher saved!')
            await logAction('ADD_TEACHER', `Added teacher: ${name} (ID: ${teacherId})`)
            closeModal('teacherModal')
            await loadTeachers()
            await updateStats()
        }
        
    // UPDATE Existing Teacher (Edit Mode)    
    } else {

        // Fields that can be updated
        const updateData = { name, email, phone, role: 'teacher' }

        // If entered a new password Update it
        if (password && password.trim() !== '') updateData.password = password
        
        const { error } = await supabase.from('users').update(updateData).eq('id', teacherId)
        
        if (error) {
            showError("Error: " + error.message)
        } else {
            showSuccess('Teacher updated!')
            closeModal('teacherModal')
            await loadTeachers()
            await updateStats()
        }
    }
    
    document.getElementById('teacherPassword').value = ''
}



// ===== Student =====

// Open Student modal in "Add" mode
document.getElementById('addStudentBtn').onclick = () => {
    currentEditStudentId = null;
    document.getElementById('studentModalTitle').textContent = 'Add Student';
    document.getElementById('saveStudentBtn').textContent = 'Create';
    document.getElementById('studentId').disabled = false;
    document.getElementById('studentId').value = '';
    document.getElementById('studentName').value = '';
    document.getElementById('studentBlock').value = '';
    document.getElementById('studentEmail').value = '';
    document.getElementById('studentPhone').value = '';
    document.getElementById('studentPassword').value = '';
    document.getElementById('studentPassword').placeholder = '******';
    showModal('studentModal');
}

// Open Student modal in "Edit" mode
window.editStudent = async (id) => {

    // Store current Student ID
    currentEditStudentId = id;

    // Query database
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
    
    // Ensures Teacher exists before trying to display data.
    if (data) {
        document.getElementById('studentModalTitle').textContent = 'Edit Student';
        document.getElementById('saveStudentBtn').textContent = 'Update';
        document.getElementById('studentId').value = id;
        document.getElementById('studentId').disabled = true;
        document.getElementById('studentName').value = data.name || '';
        document.getElementById('studentProgram').value = data.program || '';
        document.getElementById('studentLevel').value = data.level || ''; 
        document.getElementById('studentBlock').value = data.block || '';
        document.getElementById('studentEmail').value = data.email || '';
        document.getElementById('studentPhone').value = data.phone || '';
        document.getElementById('studentPassword').value = '';
        document.getElementById('studentPassword').placeholder = 'Leave blank to keep same';
        showModal('studentModal');
    }
}

// Delete Student from database
window.deleteStudent = async (id, name) => {
    showConfirm('Delete Student', name, async () => {
        await supabase.from('users').delete().eq('id', id)
        await loadStudents()
        await updateStats()
        showSuccess(`Student "${name}" deleted`)
        await logAction('DELETE_STUDENT', `Deleted student: ${name} (ID: ${id})`)
    })
}

// Save Student (Add or Edit based on mode)
document.getElementById('saveStudentBtn').onclick = async () => {

    // Get Form Values
    
    const studentId = parseInt(document.getElementById('studentId').value);
    const name = document.getElementById('studentName').value.trim();
    const email = document.getElementById('studentEmail').value.trim();
    const phone = document.getElementById('studentPhone').value.trim();
    const password = document.getElementById('studentPassword').value;
    const program = document.getElementById('studentProgram')?.value || null;
    const level = document.getElementById('studentLevel')?.value || null;
    const block = document.getElementById('studentBlock')?.value || null;
    
    // Validation
    if (!studentId || !name || !email) {
        showError('Please fill all fields')
        return;
    }
    
    // Query database
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', studentId)
        .single();
    
    // Prevent Duplicate IDs (on Add only)
    if (existing && !currentEditStudentId) {
        showError(`Student ID ${studentId} already exists!`)
        return;
    }
    
    // Check if we're in ADD mode (not editing)
    if (!currentEditStudentId) {
        // New Student must have a password
        if (!password) {
            showError('Password is required for new student')
            return;
        }
        
        // Add new row to database
        const qrValue = generateQRValue(studentId);
        const { error } = await supabase.from('users').insert({
            id: studentId, name, email, phone, password, program: program, level: level,role: 'student', block: block, qr_value: qrValue
        });
        
        if (error) {
            showError("Error: " + error.message)
        } else {
            showSuccess('Student saved!')
            await logAction('ADD_STUDENT', `Added student: ${name} (ID: ${studentId}, Program: ${program}, Level: ${level}, Block: ${block})`)
            closeModal('studentModal');
            await loadStudents()
            await updateStats()
        }

    // UPDATE Existing Student (Edit Mode)
    } else {

        // Fields that can be updated
        const updateData = { name, email, phone, role: 'student', program: program,level: level, block: block };

        // If entered a new password Update it
        if (password && password.trim() !== '') updateData.password = password;
        

        const { error } = await supabase.from('users').update(updateData).eq('id', studentId);
        
        if (error) {
            showError("Error: " + error.message)
        } else {
            showSuccess('Student updated!')
            closeModal('studentModal');
            await loadStudents()
            await updateStats()
        }
    }
    
    document.getElementById('studentPassword').value = '';
}



// ==== Class =====

// Open Class modal in "Add" mode
document.getElementById('addClassBtn').onclick = async () => {
    resetClassForm()
    document.getElementById('classModalTitle').textContent = 'Add Class'
    document.getElementById('saveClassBtn').textContent = 'Create'
    
    const select = document.getElementById('classTeacherSelect')
    select.innerHTML = '<option value="">Select Teacher</option>'
    
    const { data: teachers } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'teacher')
        .order('id')
    
    teachers?.forEach(teacher => {
        select.innerHTML += `<option value="${teacher.id}">${teacher.id} - ${teacher.name}</option>`
    })
    
    showModal('classModal')
}

// Open Class modal in "Edit" mode
window.editClass = async (id) => {
    
    // Store current Class ID
    currentEditClassId = id;

    // Query database
    const { data: classData } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .single();
    
    // Ensures Class exists before trying to display data.
    if (classData) {
        document.getElementById('classModalTitle').textContent = 'Edit Class';
        document.getElementById('saveClassBtn').textContent = 'Update';
        document.getElementById('classProgram').value = classData.program || '';
        document.getElementById('classCode').value = id;
        document.getElementById('classCode').disabled = true;
        document.getElementById('classSubject').value = classData.subject || '';
        document.getElementById('classRoom').value = classData.class_room || '';
        document.getElementById('classStartTime').value = classData.class_time_start || '';
        document.getElementById('classEndTime').value = classData.class_time_end || '';
        if (classData.class_level) {
            const radioToCheck = document.querySelector(`input[name="classLevel"][value="${classData.class_level}"]`);
            if (radioToCheck) radioToCheck.checked = true;
        }
        document.getElementById('classColor').value = classData.class_color || 'white';
        
        const blocks = classData.blocks || [];
        document.querySelectorAll('.blocks-checkbox input').forEach(cb => {
            cb.checked = blocks.includes(cb.value);
        });
        
        const building = classData.class_building || 'Main';
        const buildingRadio = document.querySelector(`input[name="classBuilding"][value="${building}"]`);
        if (buildingRadio) buildingRadio.checked = true;
        
        const days = classData.class_day || [];
        document.querySelectorAll('.days-checkbox input').forEach(cb => {
            cb.checked = days.includes(cb.value);
        });
        
        const select = document.getElementById('classTeacherSelect');
        select.innerHTML = '<option value="">Select Teacher</option>';
        
        const { data: teachers } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'teacher')
            .order('id');
        
        teachers?.forEach(teacher => {
            const selected = classData.teacher_id === teacher.id ? 'selected' : '';
            select.innerHTML += `<option value="${teacher.id}" ${selected}>${teacher.id} - ${teacher.name}</option>`;
        });
        
        showModal('classModal');
    }
};

// Delete Class from database
window.deleteClass = async (id, subject) => {
    showConfirm('Delete Class', subject, async () => {
        await supabase.from('classes').delete().eq('id', id)
        await loadClasses()
        await updateStats()
        showSuccess(`Class "${subject}" deleted`)
        await logAction('DELETE_CLASS', `Deleted class: ${subject} (ID: ${id})`)
    })
}

// Save Class (Add or Edit based on mode)
document.getElementById('saveClassBtn').onclick = async () => {

    //  Get Form Values
    const classCode = parseInt(document.getElementById('classCode').value)
    const subject = document.getElementById('classSubject').value.trim()
    const program = document.getElementById('classProgram').value || null;
    const teacherId = parseInt(document.getElementById('classTeacherSelect').value)
    const room = parseInt(document.getElementById('classRoom').value)
    const building = document.querySelector('input[name="classBuilding"]:checked')?.value || 'Main'
    const startTime = document.getElementById('classStartTime').value
    const endTime = document.getElementById('classEndTime').value
    const selectedLevel = document.querySelector('input[name="classLevel"]:checked');
    const level = selectedLevel ? parseInt(selectedLevel.value) : null;
    const color = document.getElementById('classColor').value
    
    const days = []
    document.querySelectorAll('.days-checkbox input:checked').forEach(cb => days.push(cb.value))
    
    const blocks = []
    document.querySelectorAll('.blocks-checkbox input:checked').forEach(cb => {
        blocks.push(cb.value)
    })
    
    // Validation
    if (!classCode || !subject || !teacherId || !room || !startTime || !endTime || days.length === 0) {
        showError('Please fill all fields')
        return
    }
    
    // Query database
    const { data: existing } = await supabase
        .from('classes')
        .select('id')
        .eq('id', classCode)
        .single()
    
    //Prevent Duplicate IDs (on Add only)
    if (existing && !currentEditClassId) {
        showError(`Class Code ${classCode} already exists!`)
        return
    }
    
    const data = {
        id: classCode,
        subject: subject,
        program: program, 
        teacher_id: teacherId,
        blocks: blocks,
        class_room: room,
        class_building: building,
        class_day: days,
        class_time_start: startTime,
        class_time_end: endTime,
        class_level: level,
        class_color: color
    }
    
    const { error } = await supabase.from('classes').upsert(data)
    
    if (error) {
        showError("Error: " + error.message)
    } else {
        showSuccess(currentEditClassId ? 'Class updated!' : 'Class saved!')
        await logAction(currentEditClassId ? 'EDIT_CLASS' : 'ADD_CLASS', `${currentEditClassId ? 'Edited' : 'Added'} class: ${subject} (Code: ${classCode}, Program: ${program})`)
        closeModal('classModal')
        await loadClasses()
        await updateStats()
    }
}



// ========== SPECIAL FUNCTION ==========

// View Student QR code
window.viewStudent = async (id) => {
    try {

        // Query database
        const { data: student } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single()
        
        // If Student is found Display Student Information in Modal
        if (student) {
            document.getElementById('viewStudentId').textContent = id
            document.getElementById('viewStudentName').textContent = student.name || 'N/A'
            document.getElementById('viewStudentEmail').textContent = student.email || 'N/A'
            document.getElementById('viewStudentPhone').textContent = student.phone || 'N/A'
            
            // Get QR value from database
            let qrValue = student.qr_value
            
            // where to put
            const qrDisplay = document.getElementById('viewQRCodeDisplay')
            
            // Clear before displaying
            qrDisplay.innerHTML = ''

            const canvas = document.createElement('canvas')
            
            // Generate QR code image from qr_value
            QRCode.toCanvas(canvas, qrValue, { width: 260, margin: 1 }, (error) => {
                if (error) qrDisplay.innerHTML = '<p style="color:red;">Error generating QR code</p>'
                else qrDisplay.appendChild(canvas)
            })
            
            currentViewStudentId = id
            showModal('studentViewModal')
        }
    } catch (error) {
        showError("Error loading student details: " + error.message)
    }
}

// Set up to download QR code img
document.getElementById('downloadViewQrBtn').onclick = () => {
    const canvas = document.querySelector('#viewQRCodeDisplay canvas')
    if (canvas) {
        const link = document.createElement('a')
        link.download = `QR_${currentViewStudentId}.png`
        link.href = canvas.toDataURL()
        link.click()
    }
}

// Class List Enrrolment 
// Open Add/Remove Students modal
window.addStudentToClass = async (classId, className) => {
    
    // Store class info
    currentSelectedClassId = classId
    currentSelectedClassName = className
    document.getElementById('selectedClassName').textContent = className
    
    // Get the class to know its program restriction
    const { data: classData } = await supabase
        .from('classes')
        .select('program')
        .eq('id', classId)
        .single()
    
    const classProgram = classData?.program || null
    
    // Get students - filter by program if class has one
    let query = supabase
        .from('users')
        .select('id, name, block, level, program')
        .eq('role', 'student')
        .order('id')
    
    // If class has a specific program, only show students from that program
    if (classProgram) {
        query = query.eq('program', classProgram)
    }
    
    const { data: students } = await query
    
    // Get already enrolled students for this class
    const { data: enrolled } = await supabase
        .from('class_list')
        .select('student_id')
        .eq('class_id', classId)
    
    // Store data for filtering and rendering
    modalStudentsList = students || []
    modalEnrolledIds = enrolled?.map(e => e.student_id) || []
    
    // Reset filter variables (empty arrays = show all)
    modalSelectedLevels = []
    modalSelectedBlocks = []
    
    // Reset level checkboxes (uncheck all)
    document.querySelectorAll('.level-filter-checkbox').forEach(cb => {
        cb.checked = false
        cb.onchange = () => {
            modalSelectedLevels = []
            document.querySelectorAll('.level-filter-checkbox:checked').forEach(checked => {
                modalSelectedLevels.push(checked.value)
            })
            renderModalStudentList()
        }
    })
    
    // Reset block checkboxes (uncheck all)
    document.querySelectorAll('.block-filter-checkbox').forEach(cb => {
        cb.checked = false
        cb.onchange = () => {
            modalSelectedBlocks = []
            document.querySelectorAll('.block-filter-checkbox:checked').forEach(checked => {
                modalSelectedBlocks.push(checked.value)
            })
            renderModalStudentList()
        }
    })
    
    // Keep your existing Select All and Clear All buttons for students
    document.getElementById('modalSelectAllBtn').onclick = () => {
        document.querySelectorAll('#studentsListContainer input[type="checkbox"]').forEach(cb => cb.checked = true)
    }
    
    document.getElementById('modalClearAllBtn').onclick = () => {
        document.querySelectorAll('#studentsListContainer input[type="checkbox"]').forEach(cb => cb.checked = false)
    }
    
    // Render the student list
    renderModalStudentList()
    
    // Show modal
    showModal('addStudentToClassModal')
}

// Save changes to class enrollment (add/remove students)
document.getElementById('saveAddStudentsBtn').onclick = async () => {

    // Get all checkboxes from student list
    const checkboxes = document.querySelectorAll('#studentsListContainer input[type="checkbox"]')
    
    // Collect IDs of selected (checked) students
    const selectedStudentIds = []
    checkboxes.forEach(cb => {
        if (cb.checked) selectedStudentIds.push(parseInt(cb.value))
    })
    
    // Remove all existing students from this class
    await supabase.from('class_list').delete().eq('class_id', currentSelectedClassId)
    
    // If any students were selected, add them back
    if (selectedStudentIds.length > 0) {
        const enrollments = selectedStudentIds.map(studentId => ({
            class_id: currentSelectedClassId,
            student_id: studentId
        }))
        await supabase.from('class_list').insert(enrollments)
    }
    
    // Show success message
    showSuccess(`Updated! ${selectedStudentIds.length} students in class`)

    closeModal('addStudentToClassModal')
    await loadClasses()
    await updateStats()
}

// View Class Student
// Open modal to see all students enrolled in a class
window.viewClassStudents = async (classId, className) => {

    // Query database
    const { data: classData } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single()
    
    // Display class information if found
    if (classData) {
        // Get teacher name if assigned
        let teacherName = 'Not assigned'
        if (classData.teacher_id) {
            const { data: teacher } = await supabase
                .from('users')
                .select('name')
                .eq('id', classData.teacher_id)
                .single()
            if (teacher) teacherName = teacher.name
        }
        
        // Format program display
        let programDisplay = 'All Programs (Open)'
        if (classData.program === 'BSIT') programDisplay = 'BSIT'
        else if (classData.program === 'CCS') programDisplay = 'CCS'
        else if (classData.program === 'BSEMC') programDisplay = 'BSEMC'
        
        
        // Fill class details in modal
        document.getElementById('viewClassName').textContent = classData.subject || 'N/A'
        document.getElementById('viewClassProgram').textContent = programDisplay
        document.getElementById('viewClassBuilding').textContent = classData.class_building || 'N/A'
        document.getElementById('viewClassRoom').textContent = classData.class_room || 'N/A'
        document.getElementById('viewClassDays').textContent = formatDays(classData.class_day)
        document.getElementById('viewClassTime').textContent = `${formatTime(classData.class_time_start)} - ${formatTime(classData.class_time_end)}`
        document.getElementById('viewClassLevel').textContent = classData.class_level || 'N/A'
        document.getElementById('viewClassTeacher').textContent = teacherName
    }
    
    // Query database
    const { data: enrollments } = await supabase
        .from('class_list')
        .select('student_id, users(id, name, program)')
        .eq('class_id', classId)
        .order('student_id')
    
    const studentsList = document.getElementById('classStudentsList')
    const studentCountSpan = document.getElementById('modalStudentCount')
    
    // Display message if no students enrolled
    if (!enrollments || enrollments.length === 0) {
        studentsList.innerHTML = '<p>No students enrolled in this class</p>'
        if (studentCountSpan) studentCountSpan.textContent = '0'
    } else {
        // Clear and show student count
        studentsList.innerHTML = ''
        if (studentCountSpan) studentCountSpan.textContent = enrollments.length
        
        // Display each enrolled student with program
        enrollments.forEach(enrollment => {
            const student = enrollment.users
            studentsList.innerHTML += `
                <div class="student-list-item">
                    <span><strong>${student.id}</strong> - ${student.name}</span>
                </div>
            `
        })
    }
    
    showModal('viewClassStudentsModal')
}



// ============ STATS FUNCTIONS ============
async function updateStats() {
    const { count: teacherCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher')
    
    const { count: studentCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student')
    
    const { count: classCount } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
}



// ========== EVENT LISTENER ==========


// PAGINAGTION EVENT LISTENER

// Teachers pagination
document.querySelector('.prev-teacher')?.addEventListener('click', () => {
    if (currentTeacherPage > 1) {
        currentTeacherPage--
        renderTeacherPage()
    }
})

document.querySelector('.next-teacher')?.addEventListener('click', () => {
    const filteredTeachers = getFilteredAndSortedTeachers()
    const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage)
    if (currentTeacherPage < totalPages) {
        currentTeacherPage++
        renderTeacherPage()
    }
})

// Students pagination
const prevStudentBtn = document.querySelector('.prev-student')
const nextStudentBtn = document.querySelector('.next-student')

if (prevStudentBtn) {
    prevStudentBtn.addEventListener('click', () => {
        if (currentStudentPage > 1) {
            currentStudentPage--
            renderStudentPage()
        }
    })
}

if (nextStudentBtn) {
    nextStudentBtn.addEventListener('click', () => {
        const filteredStudents = getFilteredAndSortedStudents()
        const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
        if (currentStudentPage < totalPages) {
            currentStudentPage++
            renderStudentPage()
        }
    })
}

// Classes pagination
const prevClassBtn = document.querySelector('.prev-class')
const nextClassBtn = document.querySelector('.next-class')

if (prevClassBtn) {
    prevClassBtn.addEventListener('click', () => {
        if (currentClassPage > 1) {
            currentClassPage--
            renderClassPage()
        }
    })
}

if (nextClassBtn) {
    nextClassBtn.addEventListener('click', () => {
        const filteredClasses = getFilteredAndSortedClasses()
        const totalPages = Math.ceil(filteredClasses.length / itemsPerPage)
        if (currentClassPage < totalPages) {
            currentClassPage++
            renderClassPage()
        }
    })
}



// FILTER & SORT EVENT LISTENERS

// Teacher Filter and Sort
const teacherSearchInput = document.getElementById('teacherSearch')
if (teacherSearchInput) {
    teacherSearchInput.addEventListener('input', (e) => {
        teacherSearchTerm = e.target.value
        currentTeacherPage = 1
        renderTeacherPage()
    })
}

const teacherSortSelect = document.getElementById('teacherSort')
if (teacherSortSelect) {
    teacherSortSelect.addEventListener('change', (e) => {
        teacherSortBy = e.target.value
        currentTeacherPage = 1
        renderTeacherPage()
    })
}

// Student Filter and Sort
const studentSearchInput = document.getElementById('studentSearch')
if (studentSearchInput) {
    studentSearchInput.addEventListener('input', (e) => {
        studentSearchTerm = e.target.value
        currentStudentPage = 1
        renderStudentPage()
    })
}

const studentSortSelect = document.getElementById('studentSort')
if (studentSortSelect) {
    studentSortSelect.addEventListener('change', (e) => {
        studentSortBy = e.target.value
        currentStudentPage = 1
        renderStudentPage()
    })
}


// Program Filter and Sort Button
const programFilterBtns = document.querySelectorAll('.program-filter-btn')
if (programFilterBtns.length > 0) {
    programFilterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all program buttons
            programFilterBtns.forEach(b => b.classList.remove('active'))
            // Add active class to clicked button
            btn.classList.add('active')
            // Set the program filter value
            studentProgramFilter = btn.getAttribute('data-program')
            // Reset to first page and re-render
            currentStudentPage = 1
            renderStudentPage()
        })
    })
}

// Level Filter and Sort Button
const levelFilterBtns = document.querySelectorAll('.level-filter-btn')
if (levelFilterBtns.length > 0) {
    levelFilterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all level buttons
            levelFilterBtns.forEach(b => b.classList.remove('active'))
            // Add active class to clicked button
            btn.classList.add('active')
            // Set the level filter value
            studentLevelFilter = btn.getAttribute('data-level')
            // Reset to first page and re-render
            currentStudentPage = 1
            renderStudentPage()
        })
    })
}

// Block Filter and Sort Button
const blockFilterBtns = document.querySelectorAll('.block-filter-btn')
if (blockFilterBtns.length > 0) {
    blockFilterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all buttons
            blockFilterBtns.forEach(b => b.classList.remove('active'))
            // Add active class to clicked button
            btn.classList.add('active')
            // Set the block filter value
            studentBlockFilter = btn.getAttribute('data-block')
            // Reset to first page and re-render
            currentStudentPage = 1
            renderStudentPage()
        })
    })
}


// Class Filter and Sort
const classSearchInput = document.getElementById('classSearch')
if (classSearchInput) {
    classSearchInput.addEventListener('input', (e) => {
        classSearchTerm = e.target.value
        currentClassPage = 1
        renderClassPage()
    })
}

const classSortSelect = document.getElementById('classSort')
if (classSortSelect) {
    classSortSelect.addEventListener('change', (e) => {
        classSortBy = e.target.value
        currentClassPage = 1
        renderClassPage()
    })
}



// ========== SCHOOL-WIDE ATTENDANCE SUMMARY ==========
// ========== SCHOOL-WIDE ATTENDANCE SUMMARY WITH DONUT CHARTS ==========

let attendanceCharts = {}

async function loadAttendanceSummary() {
    const container = document.getElementById('attendanceSummaryContainer')
    container.innerHTML = '<div style="text-align: center; padding: 40px;">Loading attendance data...</div>'
    
    try {
        // Define all programs
        const allPrograms = ['BSIT', 'BSCS', 'BSEMC']
        
        let summaryHtml = `<div class="donut-grid" id="donutGrid">`
        
        // Store chart data to create after HTML is inserted
        const chartsToCreate = []
        
        for (const program of allPrograms) {
            // Get students in this program
            const { data: students } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'student')
                .eq('program', program)
            
            const studentIds = students?.map(s => s.id) || []
            const studentCount = studentIds.length
            
            // Get classes - include classes with this SPECIFIC program OR NULL (all programs)
            const { data: classes } = await supabase
                .from('classes')
                .select('id')
                .or(`program.eq.${program},program.is.null`)
            
            const classIds = classes?.map(c => c.id) || []
            const classCount = classIds.length
            
            if (studentCount === 0) {
                summaryHtml += `
                    <div class="donut-card">
                        <h3>${program}</h3>
                        <div class="no-data-text">No students enrolled</div>
                        <div class="program-summary-stats">
                            <div class="program-stat">
                                <div class="program-stat-label">Total Students</div>
                                <div class="program-stat-value">0</div>
                            </div>
                            <div class="program-stat">
                                <div class="program-stat-label">Total Classes</div>
                                <div class="program-stat-value">0</div>
                            </div>
                            <div class="program-stat">
                                <div class="program-stat-label">Attendance Rate</div>
                                <div class="program-stat-value">0%</div>
                            </div>
                        </div>
                    </div>
                `
                continue
            }
            
            if (classCount === 0) {
                summaryHtml += `
                    <div class="donut-card">
                        <h3>${program}</h3>
                        <div class="no-data-text">No classes available</div>
                        <div class="program-summary-stats">
                            <div class="program-stat">
                                <div class="program-stat-label">Total Students</div>
                                <div class="program-stat-value">${studentCount}</div>
                            </div>
                            <div class="program-stat">
                                <div class="program-stat-label">Total Classes</div>
                                <div class="program-stat-value">0</div>
                            </div>
                            <div class="program-stat">
                                <div class="program-stat-label">Attendance Rate</div>
                                <div class="program-stat-value">0%</div>
                            </div>
                        </div>
                    </div>
                `
                continue
            }
            
            // Get sessions for these classes
            const { data: sessions } = await supabase
                .from('sessions')
                .select('id')
                .in('class_id', classIds)
            
            const sessionIds = sessions?.map(s => s.id) || []
            
            if (sessionIds.length === 0) {
                summaryHtml += `
                    <div class="donut-card">
                        <h3>${program}</h3>
                        <div class="no-data-text">No sessions created</div>
                        <div class="program-summary-stats">
                            <div class="program-stat">
                                <div class="program-stat-label">Total Students</div>
                                <div class="program-stat-value">${studentCount}</div>
                            </div>
                            <div class="program-stat">
                                <div class="program-stat-label">Total Classes</div>
                                <div class="program-stat-value">${classCount}</div>
                            </div>
                            <div class="program-stat">
                                <div class="program-stat-label">Attendance Rate</div>
                                <div class="program-stat-value">0%</div>
                            </div>
                        </div>
                    </div>
                `
                continue
            }
            
            // Get attendance records
            const { data: attendances } = await supabase
                .from('attendances')
                .select('status')
                .in('session_id', sessionIds)
                .in('student_id', studentIds)
            
            let present = 0, late = 0, absent = 0
            
            if (attendances) {
                attendances.forEach(a => {
                    if (a.status === 'present') present++
                    else if (a.status === 'late') late++
                    else if (a.status === 'absent') absent++
                })
            }
            
            const total = present + late + absent
            const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0
            
            const chartId = `donut_${program.replace(/[^a-zA-Z0-9]/g, '_')}`
            
            summaryHtml += `
                <div class="donut-card" data-program="${program}">
                    <h3>${program}</h3>
                    <div class="donut-chart-wrapper">
                        <canvas id="${chartId}" class="donut-chart" width="140" height="140"></canvas>
                    </div>
                    <div class="program-summary-stats">
                        <div class="program-stat">
                            <div class="program-stat-label">Total Students</div>
                            <div class="program-stat-value">${studentCount}</div>
                        </div>
                        <div class="program-stat">
                            <div class="program-stat-label">Total Classes</div>
                            <div class="program-stat-value">${classCount}</div>
                        </div>
                        <div class="program-stat">
                            <div class="program-stat-label">Attendance Rate</div>
                            <div class="program-stat-value">${rate}%</div>
                        </div>
                    </div>
                </div>
            `
            
            // Store data for chart creation
            chartsToCreate.push({ chartId, present, late, absent })
        }
        
        summaryHtml += '</div>'
        container.innerHTML = summaryHtml
        
        // Create charts after DOM is ready
        setTimeout(() => {
            chartsToCreate.forEach(({ chartId, present, late, absent }) => {
                createDonutChart(chartId, present, late, absent)
            })
        }, 100)
        
    } catch (error) {
        console.error('Error loading attendance summary:', error)
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: red;">Error loading attendance data</div>'
    }
}

// Create donut chart
function createDonutChart(canvasId, present, late, absent) {
    const canvas = document.getElementById(canvasId)
    if (!canvas) {
        setTimeout(() => {
            const retryCanvas = document.getElementById(canvasId)
            if (retryCanvas) {
                createDonutChart(canvasId, present, late, absent)
            }
        }, 50)
        return
    }
    
    if (attendanceCharts[canvasId]) {
        attendanceCharts[canvasId].destroy()
    }
    
    const ctx = canvas.getContext('2d')
    
    attendanceCharts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Late', 'Absent'],
            datasets: [{
                data: [present, late, absent],
                backgroundColor: ['#4CAF50', '#FFC107', '#f44336'],
                borderWidth: 2,
                cutout: '65%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (tooltipItem) => {
                            const value = tooltipItem.raw
                            const total = present + late + absent
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0
                            const label = tooltipItem.label
                            return `${label}: ${value} (${percentage}%)`
                        }
                    }
                }
            }
        }
    })
}


// ========== SYSTEM POLICY CONFIGURATION ==========

// Load current policy settings
async function loadPolicySettings() {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('late_threshold_minutes, minimum_attendance_rate')
            .eq('id', 1)
            .single()
        
        if (data) {
            document.getElementById('lateThreshold').value = data.late_threshold_minutes || 30
            document.getElementById('minAttendanceRate').value = data.minimum_attendance_rate || 75
        }
    } catch (error) {
        console.error('Error loading policy:', error)
    }
}

// Save policy settings
async function savePolicySettings() {
    const lateThreshold = parseInt(document.getElementById('lateThreshold').value)
    const minAttendanceRate = parseInt(document.getElementById('minAttendanceRate').value)
    
    if (lateThreshold < 1 || lateThreshold > 120) {
        showError('Late threshold must be between 1 and 120 minutes')
        return
    }
    
    if (minAttendanceRate < 0 || minAttendanceRate > 100) {
        showError('Minimum attendance rate must be between 0 and 100%')
        return
    }
    
    const adminName = sessionStorage.getItem('userName') || 'Admin'
    
    const { error } = await supabase
        .from('system_settings')
        .update({
            late_threshold_minutes: lateThreshold,
            minimum_attendance_rate: minAttendanceRate,
            updated_at: new Date(),
            updated_by: adminName
        })
        .eq('id', 1)
    
    if (error) {
        showError('Error saving: ' + error.message)
    } else {
        showSuccess(`Settings saved! Late: ${lateThreshold} min | Min Rate: ${minAttendanceRate}%`)
        await logAction('UPDATE_SETTINGS', `Changed late threshold to ${lateThreshold} min, min rate to ${minAttendanceRate}%`)
    }
}

// Event listener
document.getElementById('savePolicyBtn').addEventListener('click', savePolicySettings)















// ========== HELPER: Parse CSV Line ==========
function parseCSVLine(line) {
    const result = [];
    let inQuotes = false;
    let currentCell = '';
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(currentCell);
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    result.push(currentCell);
    
    const cleaned = result.map(cell => cell.trim().replace(/^'/, ''));
    
    while (cleaned.length > 0 && cleaned[cleaned.length - 1] === '') {
        cleaned.pop();
    }
    
    return cleaned;
}

// ========== BULK UPLOAD TEACHERS ==========
document.getElementById('addBulkTeacherBtn')?.addEventListener('click', () => {
    document.getElementById('teacherCsvFile').value = '';
    document.getElementById('bulkUploadPreview').style.display = 'none';
    showModal('bulkTeacherModal');
});

document.getElementById('teacherCsvFile')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const csvText = event.target.result;
        const lines = csvText.split('\n').filter(line => line.trim());
        const previewDiv = document.getElementById('bulkUploadPreview');
        const previewContent = document.getElementById('previewContent');
        
        if (lines.length === 0) {
            previewContent.innerHTML = '<p>No data found</p>';
            previewDiv.style.display = 'block';
            return;
        }
        
        let previewHtml = '<table style="width: 100%; border-collapse: collapse; font-size: 11px;">';
        lines.forEach((line) => {
            const cells = parseCSVLine(line);
            previewHtml += '</tr>';
            cells.forEach(cell => {
                let displayCell = cell.replace(/^'/, '');
                if (displayCell.length > 30) displayCell = displayCell.substring(0, 27) + '...';
                previewHtml += `<td style="border: 1px solid #ddd; padding: 4px;">${displayCell || '&nbsp;'}<\/td>`;
            });
            previewHtml += '</tr>';
        });
        previewHtml += '</table>';
        previewContent.innerHTML = previewHtml;
        previewDiv.style.display = 'block';
        previewDiv.style.maxHeight = '250px';
        previewDiv.style.overflowY = 'auto';
    };
    reader.readAsText(file);
});

document.getElementById('confirmBulkUploadBtn')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('teacherCsvFile');
    const file = fileInput.files[0];
    if (!file) { showError('Please select a CSV file'); return; }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const csvText = event.target.result;
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) { showError('CSV must have header row'); return; }
        
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
        const expectedHeaders = ['id', 'name', 'email', 'phone', 'password'];
        const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) { showError(`Missing columns: ${missingHeaders.join(', ')}`); return; }
        
        const teachers = [];
        const errors = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const teacher = {};
            headers.forEach((header, idx) => {
                let value = values[idx] || '';
                if (value.startsWith("'")) value = value.substring(1);
                teacher[header] = value;
            });
            
            if (!teacher.id || !teacher.name || !teacher.email || !teacher.password) {
                errors.push(`Row ${i}: Missing required fields`);
                continue;
            }
            if (isNaN(parseInt(teacher.id))) { errors.push(`Row ${i}: ID must be a number`); continue; }
            
            teachers.push({
                id: parseInt(teacher.id), name: teacher.name, email: teacher.email,
                phone: teacher.phone || null, password: teacher.password, role: 'teacher'
            });
        }
        
        if (errors.length > 0) { showError(`Errors:\n${errors.slice(0,5).join('\n')}`); return; }
        
        const teacherIds = teachers.map(t => t.id);
        const { data: existing } = await supabase.from('users').select('id').in('id', teacherIds).eq('role', 'teacher');
        if (existing?.length > 0) { showError(`IDs already exist: ${existing.map(e=>e.id).join(', ')}`); return; }
        
        showInfo(`Uploading ${teachers.length} teachers...`);
        let successCount = 0;
        for (let i = 0; i < teachers.length; i += 100) {
            const batch = teachers.slice(i, i + 100);
            const { error } = await supabase.from('users').insert(batch);
            if (!error) successCount += batch.length;
        }
        
        if (successCount > 0) {
            showSuccess(`Added ${successCount} teachers!`);
            await logAction('BULK_UPLOAD_TEACHERS', `Added ${successCount} teachers`);
            await loadTeachers();
            closeModal('bulkTeacherModal');
            document.getElementById('teacherCsvFile').value = '';
            document.getElementById('bulkUploadPreview').style.display = 'none';
        }
    };
    reader.readAsText(file);
});

// ========== BULK UPLOAD STUDENTS ==========
document.getElementById('addBulkStudentBtn')?.addEventListener('click', () => {
    document.getElementById('studentCsvFile').value = '';
    document.getElementById('bulkStudentPreview').style.display = 'none';
    showModal('bulkStudentModal');
});

document.getElementById('studentCsvFile')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const csvText = event.target.result;
        const lines = csvText.split('\n').filter(line => line.trim());
        const previewDiv = document.getElementById('bulkStudentPreview');
        const previewContent = document.getElementById('studentPreviewContent');
        
        if (lines.length === 0) { previewContent.innerHTML = '<p>No data found</p>'; previewDiv.style.display = 'block'; return; }
        
        let previewHtml = '<table style="width: 100%; border-collapse: collapse; font-size: 11px;">';
        lines.forEach((line) => {
            const cells = parseCSVLine(line);
            previewHtml += '<tr>';
            cells.forEach(cell => {
                let displayCell = cell.replace(/^'/, '');
                if (displayCell.length > 25) displayCell = displayCell.substring(0, 22) + '...';
                previewHtml += `<td style="border: 1px solid #ddd; padding: 4px;">${displayCell || '&nbsp;'}<\/td>`;
            });
            previewHtml += '</tr>';
        });
        previewHtml += '</table>';
        previewContent.innerHTML = previewHtml;
        previewDiv.style.display = 'block';
        previewDiv.style.maxHeight = '250px';
        previewDiv.style.overflowY = 'auto';
    };
    reader.readAsText(file);
});

document.getElementById('confirmBulkStudentBtn')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('studentCsvFile');
    const file = fileInput.files[0];
    if (!file) { showError('Please select a CSV file'); return; }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const csvText = event.target.result;
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) { showError('CSV must have header row'); return; }
        
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
        const expectedHeaders = ['id', 'name', 'program', 'level', 'block', 'email', 'phone', 'password'];
        const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) { showError(`Missing columns: ${missingHeaders.join(', ')}`); return; }
        
        const students = [];
        const errors = [];
        const validPrograms = ['BSIT', 'BSCS', 'BSEMC'];
        const validLevels = ['1','2','3','4','5','6'];
        const validBlocks = ['A','B','C','D'];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const student = {};
            headers.forEach((header, idx) => {
                let value = values[idx] || '';
                if (value.startsWith("'")) value = value.substring(1);
                student[header] = value;
            });
            
            if (!student.id || !student.name || !student.program || !student.level || !student.block || !student.email || !student.password) {
                errors.push(`Row ${i}: Missing required fields`);
                continue;
            }
            if (isNaN(parseInt(student.id))) { errors.push(`Row ${i}: ID must be a number`); continue; }
            if (!validPrograms.includes(student.program.toUpperCase())) { errors.push(`Row ${i}: Invalid program`); continue; }
            if (!validLevels.includes(student.level.toString())) { errors.push(`Row ${i}: Level must be 1-6`); continue; }
            if (!validBlocks.includes(student.block.toUpperCase())) { errors.push(`Row ${i}: Block must be A-D`); continue; }
            
            students.push({
                id: parseInt(student.id), name: student.name, program: student.program.toUpperCase(),
                level: parseInt(student.level), block: student.block.toUpperCase(), email: student.email,
                phone: student.phone || null, password: student.password, role: 'student',
                qr_value: generateQRValue(parseInt(student.id))
            });
        }
        
        if (errors.length > 0) { showError(`Errors:\n${errors.slice(0,5).join('\n')}`); return; }
        
        const studentIds = students.map(s => s.id);
        const { data: existing } = await supabase.from('users').select('id').in('id', studentIds).eq('role', 'student');
        if (existing?.length > 0) { showError(`IDs already exist: ${existing.map(e=>e.id).join(', ')}`); return; }
        
        showInfo(`Uploading ${students.length} students...`);
        let successCount = 0;
        for (let i = 0; i < students.length; i += 100) {
            const batch = students.slice(i, i + 100);
            const { error } = await supabase.from('users').insert(batch);
            if (!error) successCount += batch.length;
        }
        
        if (successCount > 0) {
            showSuccess(`Added ${successCount} students!`);
            await logAction('BULK_UPLOAD_STUDENTS', `Added ${successCount} students`);
            await loadStudents();
            closeModal('bulkStudentModal');
            document.getElementById('studentCsvFile').value = '';
            document.getElementById('bulkStudentPreview').style.display = 'none';
        }
    };
    reader.readAsText(file);
});

// ========== BULK UPLOAD CLASSES ==========
document.getElementById('addBulkClassBtn')?.addEventListener('click', () => {
    document.getElementById('classCsvFile').value = '';
    document.getElementById('bulkClassPreview').style.display = 'none';
    showModal('bulkClassModal');
});

document.getElementById('classCsvFile')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const csvText = event.target.result;
        const lines = csvText.split('\n').filter(line => line.trim());
        const previewDiv = document.getElementById('bulkClassPreview');
        const previewContent = document.getElementById('classPreviewContent');
        
        if (lines.length === 0) { previewContent.innerHTML = '<p>No data found</p>'; previewDiv.style.display = 'block'; return; }
        
        let previewHtml = '<table style="width: 100%; border-collapse: collapse; font-size: 10px;">';
        lines.forEach((line) => {
            const cells = parseCSVLine(line);
            previewHtml += '<tr>';
            cells.forEach(cell => {
                let displayCell = cell.replace(/^'/, '');
                if (displayCell.length > 20) displayCell = displayCell.substring(0, 17) + '...';
                previewHtml += `<td style="border: 1px solid #ddd; padding: 4px;">${displayCell || '&nbsp;'}<\/td>`;
            });
            previewHtml += '</tr>';
        });
        previewHtml += '<table>';
        previewContent.innerHTML = previewHtml;
        previewDiv.style.display = 'block';
        previewDiv.style.maxHeight = '250px';
        previewDiv.style.overflowY = 'auto';
    };
    reader.readAsText(file);
});

document.getElementById('confirmBulkClassBtn')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('classCsvFile');
    const file = fileInput.files[0];
    if (!file) { showError('Please select a CSV file'); return; }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const csvText = event.target.result;
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) { showError('CSV must have header row'); return; }
        
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
        const expectedHeaders = ['id', 'subject', 'program', 'teacher_id', 'blocks', 'class_room', 'class_building', 'class_day', 'class_time_start', 'class_time_end', 'class_level', 'class_color'];
        const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) { showError(`Missing columns: ${missingHeaders.join(', ')}`); return; }
        
        const { data: teachers } = await supabase.from('users').select('id').eq('role', 'teacher');
        const validTeacherIds = teachers?.map(t => t.id) || [];
        
        const classes = [];
        const errors = [];
        const validPrograms = ['BSIT', 'BSCS', 'BSEMC', ''];
        const validBuildings = ['Main', 'Annex'];
        const validDays = ['M', 'T', 'W', 'Th', 'F', 'S'];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const classItem = {};
            headers.forEach((header, idx) => {
                let value = values[idx] || '';
                if (value.startsWith("'")) value = value.substring(1);
                classItem[header] = value;
            });
            
            if (!classItem.id || !classItem.subject || !classItem.teacher_id || !classItem.class_room || !classItem.class_day || !classItem.class_time_start || !classItem.class_time_end) {
                errors.push(`Row ${i}: Missing required fields`);
                continue;
            }
            if (isNaN(parseInt(classItem.id))) { errors.push(`Row ${i}: ID must be a number`); continue; }
            if (!validTeacherIds.includes(parseInt(classItem.teacher_id))) { errors.push(`Row ${i}: Teacher ${classItem.teacher_id} not found`); continue; }
            if (classItem.program && !validPrograms.includes(classItem.program)) { errors.push(`Row ${i}: Invalid program`); continue; }
            
            let blocks = classItem.blocks ? classItem.blocks.split(',').map(b => b.trim()) : [];
            let days = classItem.class_day.split(',').map(d => d.trim());
            let invalidDays = days.filter(d => !validDays.includes(d));
            if (invalidDays.length > 0) { errors.push(`Row ${i}: Invalid days: ${invalidDays.join(',')}`); continue; }
            
            let level = classItem.class_level ? parseInt(classItem.class_level) : null;
            if (level && (level < 1 || level > 6)) { errors.push(`Row ${i}: Level must be 1-6`); continue; }
            
            classes.push({
                id: parseInt(classItem.id), subject: classItem.subject, program: classItem.program || null,
                teacher_id: parseInt(classItem.teacher_id), blocks: blocks, class_room: parseInt(classItem.class_room),
                class_building: classItem.class_building || 'Main', class_day: days,
                class_time_start: classItem.class_time_start, class_time_end: classItem.class_time_end,
                class_level: level, class_color: classItem.class_color || 'orange'
            });
        }
        
        if (errors.length > 0) { showError(`Errors:\n${errors.slice(0,5).join('\n')}`); return; }
        
        const classIds = classes.map(c => c.id);
        const { data: existing } = await supabase.from('classes').select('id').in('id', classIds);
        if (existing?.length > 0) { showError(`Class IDs already exist: ${existing.map(e=>e.id).join(', ')}`); return; }
        
        showInfo(`Uploading ${classes.length} classes...`);
        let successCount = 0;
        for (let i = 0; i < classes.length; i += 100) {
            const batch = classes.slice(i, i + 100);
            const { error } = await supabase.from('classes').insert(batch);
            if (!error) successCount += batch.length;
        }
        
        if (successCount > 0) {
            showSuccess(`Added ${successCount} classes!`);
            await logAction('BULK_UPLOAD_CLASSES', `Added ${successCount} classes`);
            await loadClasses();
            closeModal('bulkClassModal');
            document.getElementById('classCsvFile').value = '';
            document.getElementById('bulkClassPreview').style.display = 'none';
        }
    };
    reader.readAsText(file);
});



// ============ INITIALIZE ============
async function init() {
    await loadTeachers()
    await loadStudents()
    await loadClasses()
    await updateStats()
    await loadAttendanceSummary() 
    await loadPolicySettings()
}

init()