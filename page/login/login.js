import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase Connection
const supabaseUrl = 'https://bkxtmevrfpfhwrwildpx.supabase.co'
const supabaseAnonKey = 'sb_publishable_zkt89flZIVC5aEtgR7eOLQ_y20L9oGY'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// AUDIT LOG FUNCTION (add this)
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
    const existingMsg = document.querySelector('.floating-message')
    if (existingMsg) existingMsg.remove()
    
    const msg = document.createElement('div')
    msg.className = `floating-message ${type}`
    msg.textContent = message
    document.body.appendChild(msg)
    
    setTimeout(() => msg.remove(), 2000)
}

// Shortcuts
function showSuccess(msg) { showMessage(msg, 'success') }
function showError(msg) { showMessage(msg, 'error') }
function showInfo(msg) { showMessage(msg, 'info') }

// Login functionality
const loginBtn = document.getElementById('loginBtn')

loginBtn.addEventListener('click', async () => {
    const userId = document.getElementById('userId').value.trim()
    const password = document.getElementById('password').value.trim()
    
    if (!userId) {
        showError(`Please enter User ID`)
        return
    }
    
    if (!password) {
        showError('Please enter Password')
        return
    }
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', parseInt(userId))
            .single()
        
        if (error) {
            showError('User not found.')
            return
        }
     
        if (data.password !== password) {
            showError('Incorrect password.')
            return
        }
        
        sessionStorage.setItem('userId', data.id)
        sessionStorage.setItem('userRole', data.role)
        sessionStorage.setItem('userName', data.name)
        sessionStorage.setItem('userProgram', data.program || '')
    
        // TRACK LOGIN FOR ADMIN & SUPER ADMIN
        if (data.role === 'super_admin' || data.role === 'admin') {
            await supabase.from('audit_logs').insert({
                user_id: data.id,
                user_name: data.name,
                user_role: data.role,
                action: 'LOGIN',
                details: `${data.role.toUpperCase()} ${data.name} (ID: ${data.id}) logged in`
            })
            console.log('Login tracked for:', data.role)
        }
        
        if (data.role === 'super_admin') {
            window.location.href = '/page/super_admin/superAdminDashboard.html'
        } else if (data.role === 'admin') {
            window.location.href = '/page/admin/adminDashboard.html'
        } else if (data.role === 'teacher') {
            window.location.href = '/page/teacher/teacherClassList.html'
        } else if (data.role === 'student') {
            window.location.href = '/page/student/studentClassList.html'
        }
        
    } catch (error) {
        console.error('Login error:', error)
        showError('Error during login: ' + error.message)
    }
})

// Open modal
function openPasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'flex'
    // Clear fields
    document.getElementById('changeUserId').value = ''
    document.getElementById('currentPassword').value = ''
    document.getElementById('newPassword').value = ''
    document.getElementById('confirmPassword').value = ''
}

// Close modal
window.closePasswordModal = function() {
    document.getElementById('changePasswordModal').style.display = 'none'
}

// Change Password link click
document.getElementById('changePasswordLink').addEventListener('click', (e) => {
    e.preventDefault()
    openPasswordModal()
})

// Save/Update Password
document.getElementById('savePasswordBtn').addEventListener('click', async () => {
    const userId = document.getElementById('changeUserId').value.trim()
    const currentPassword = document.getElementById('currentPassword').value.trim()
    const newPassword = document.getElementById('newPassword').value.trim()
    const confirmPassword = document.getElementById('confirmPassword').value.trim()
    
    // Validation
    if (!userId) {
        showError('Please enter your User ID')
        return
    }
    
    if (!currentPassword) {
        showError('Please enter your current password')
        return
    }
    
    if (!newPassword) {
        showError('Please enter a new password')
        return
    }
    
    if (newPassword !== confirmPassword) {
        showError('New password and confirmation do not match')
        return
    }
    
    if (newPassword.length < 4) {
        showError('New password must be at least 4 characters')
        return
    }
    
    try {
        // Find the user
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('id', parseInt(userId))
            .single()
        
        if (findError || !user) {
            showError('User not found')
            return
        }
        
        // Verify current password
        if (user.password !== currentPassword) {
            showError('Current password is incorrect')
            return
        }
        
        // Update to new password
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: newPassword })
            .eq('id', parseInt(userId))
        
        if (updateError) {
            showError('Failed to update password: ' + updateError.message)
            return
        }
        
        showSuccess('Password changed successfully!')
        closePasswordModal()
        
    } catch (error) {
        console.error('Password change error:', error)
        showError('Error changing password')
    }
})

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('changePasswordModal')
    if (event.target === modal) {
        closePasswordModal()
    }
}