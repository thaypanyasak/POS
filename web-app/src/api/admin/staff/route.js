import { createClient } from '@supabase/supabase-js';

// Khởi tạo Supabase Admin Client với SERVICE_ROLE_KEY (Chỉ chạy trên Server-side / API Route)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qanphpmphnipyuwcadwz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Helper: Xác thực Token người gửi có phải là Quản trị viên (role === 'admin')
 */
async function verifyAdminCaller(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return { isAdmin: false, error: 'Thiếu Bearer Token xác thực' };
  }

  // Lấy thông tin user từ token
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return { isAdmin: false, error: 'Token không hợp lệ hoặc đã hết hạn' };
  }

  // Kiểm tra vai trò trong bảng profiles
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin' || !profile.is_active) {
    return { isAdmin: false, error: 'Từ chối truy cập: Quyền Quản trị viên (Admin) được yêu cầu' };
  }

  return { isAdmin: true, user, profile };
}

/**
 * POST /api/admin/staff
 * Tạo tài khoản nhân viên mới (auth.users + profiles)
 */
export async function POST(request) {
  try {
    // 1. Kiểm tra quyền Admin
    const authCheck = await verifyAdminCaller(request);
    if (!authCheck.isAdmin) {
      return Response.json({ success: false, error: authCheck.error }, { status: 403 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { email, password, fullName, role = 'cashier', pinCode = '1234' } = body;

    if (!email || !password || !fullName) {
      return Response.json(
        { success: false, error: 'Vui lòng cung cấp đầy đủ email, password và họ tên nhân viên' },
        { status: 400 }
      );
    }

    // 3. Tạo tài khoản trong auth.users bằng Admin API
    const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true, // Tự động xác thực email không cần gửi mail xác nhận
      user_metadata: {
        full_name: fullName.trim(),
        role: role,
        pin_code: String(pinCode).trim(),
      },
    });

    if (createError) {
      return Response.json({ success: false, error: createError.message }, { status: 400 });
    }

    // 4. Đồng bộ hoặc cập nhật bảng profiles
    const newUserId = authUser.user.id;
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: newUserId,
      email: email.trim(),
      full_name: fullName.trim(),
      role: role,
      pin_code: String(pinCode).trim(),
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      return Response.json({ success: false, error: profileError.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      data: {
        id: newUserId,
        email,
        fullName,
        role,
        pinCode,
        isActive: true,
      },
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/staff
 * Cập nhật thông tin nhân viên hoặc đặt lại mật khẩu / mã PIN
 */
export async function PUT(request) {
  try {
    const authCheck = await verifyAdminCaller(request);
    if (!authCheck.isAdmin) {
      return Response.json({ success: false, error: authCheck.error }, { status: 403 });
    }

    const body = await request.json();
    const { staffId, fullName, role, pinCode, isActive, newPassword } = body;

    if (!staffId) {
      return Response.json({ success: false, error: 'Thiếu staffId' }, { status: 400 });
    }

    // Nếu có yêu cầu đặt lại mật khẩu
    if (newPassword && newPassword.trim().length >= 6) {
      const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(staffId, {
        password: newPassword.trim(),
      });
      if (pwdError) {
        return Response.json({ success: false, error: pwdError.message }, { status: 400 });
      }
    }

    // Cập nhật thông tin profile
    const updateFields = { updated_at: new Date().toISOString() };
    if (fullName) updateFields.full_name = fullName.trim();
    if (role) updateFields.role = role;
    if (pinCode) updateFields.pin_code = String(pinCode).trim();
    if (isActive !== undefined) updateFields.is_active = Boolean(isActive);

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateFields)
      .eq('id', staffId)
      .select()
      .maybeSingle();

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return Response.json({ success: true, data: updatedProfile });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/staff
 * Xóa vĩnh viễn hoặc vô hiệu hóa tài khoản nhân viên
 */
export async function DELETE(request) {
  try {
    const authCheck = await verifyAdminCaller(request);
    if (!authCheck.isAdmin) {
      return Response.json({ success: false, error: authCheck.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('id');

    if (!staffId) {
      return Response.json({ success: false, error: 'Thiếu staffId' }, { status: 400 });
    }

    // Vô hiệu hóa trong profiles để bảo toàn lịch sử hóa đơn
    await supabaseAdmin
      .from('profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', staffId);

    // Xóa khỏi auth.users để ngăn chặn đăng nhập
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(staffId);
    if (deleteAuthError) {
      console.warn('Delete auth user notice:', deleteAuthError.message);
    }

    return Response.json({ success: true, message: 'Đã vô hiệu hóa và xóa tài khoản nhân viên thành công' });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
