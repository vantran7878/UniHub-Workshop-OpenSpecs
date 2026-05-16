// User model
class User {
  final String id;
  final String email;
  final String fullName;
  final String? studentId;
  final String role; // 'student', 'staff', 'admin'
  final DateTime? createdAt;

  User({
    required this.id,
    required this.email,
    required this.fullName,
    this.studentId,
    required this.role,
    this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      fullName: json['full_name'] as String,
      studentId: json['student_id'] as String?,
      role: json['role'] as String? ?? 'student',
      createdAt: json['created_at'] != null 
        ? DateTime.parse(json['created_at'] as String)
        : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'full_name': fullName,
    'student_id': studentId,
    'role': role,
    'created_at': createdAt?.toIso8601String(),
  };
}

// Workshop model
class Workshop {
  final String id;
  final String title;
  final String description;
  final DateTime startTime;
  final DateTime? endTime;
  final String roomName;
  final int capacity;
  final int confirmedCount;
  final int fee;
  final bool isPublished;

  Workshop({
    required this.id,
    required this.title,
    required this.description,
    required this.startTime,
    this.endTime,
    required this.roomName,
    required this.capacity,
    required this.confirmedCount,
    required this.fee,
    required this.isPublished,
  });

  factory Workshop.fromJson(Map<String, dynamic> json) {
    return Workshop(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String? ?? '',
      startTime: DateTime.parse(json['start_time'] as String),
      endTime: json['end_time'] != null 
        ? DateTime.parse(json['end_time'] as String)
        : null,
      roomName: json['room_name'] as String? ?? 'TBD',
      capacity: json['capacity'] as int? ?? 0,
      confirmedCount: json['confirmed_count'] as int? ?? 0,
      fee: json['fee'] as int? ?? 0,
      isPublished: json['is_published'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'description': description,
    'start_time': startTime.toIso8601String(),
    'end_time': endTime?.toIso8601String(),
    'room_name': roomName,
    'capacity': capacity,
    'confirmed_count': confirmedCount,
    'fee': fee,
    'is_published': isPublished,
  };
}

// Registration model
class Registration {
  final String id;
  final String workshopId;
  final String userId;
  final String status; // 'pending', 'confirmed', 'cancelled'
  final String? qrCode;
  final String? qrCodeUrl;
  final DateTime createdAt;
  final DateTime? confirmedAt;
  final DateTime? cancelledAt;
  final String? cancelReason;

  Registration({
    required this.id,
    required this.workshopId,
    required this.userId,
    required this.status,
    this.qrCode,
    this.qrCodeUrl,
    required this.createdAt,
    this.confirmedAt,
    this.cancelledAt,
    this.cancelReason,
  });

  factory Registration.fromJson(Map<String, dynamic> json) {
    return Registration(
      id: json['id'] as String,
      workshopId: json['workshop_id'] as String,
      userId: json['user_id'] as String,
      status: json['status'] as String? ?? 'pending',
      qrCode: json['qr_code'] as String?,
      qrCodeUrl: json['qr_code_url'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      confirmedAt: json['confirmed_at'] != null
        ? DateTime.parse(json['confirmed_at'] as String)
        : null,
      cancelledAt: json['cancelled_at'] != null
        ? DateTime.parse(json['cancelled_at'] as String)
        : null,
      cancelReason: json['cancel_reason'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'workshop_id': workshopId,
    'user_id': userId,
    'status': status,
    'qr_code': qrCode,
    'qr_code_url': qrCodeUrl,
    'created_at': createdAt.toIso8601String(),
    'confirmed_at': confirmedAt?.toIso8601String(),
    'cancelled_at': cancelledAt?.toIso8601String(),
    'cancel_reason': cancelReason,
  };
}

// Checkin model
class Checkin {
  final String id;
  final String registrationId;
  final String workshopId;
  final String? checkedInBy;
  final DateTime checkedInAt;
  final String? notes;

  Checkin({
    required this.id,
    required this.registrationId,
    required this.workshopId,
    this.checkedInBy,
    required this.checkedInAt,
    this.notes,
  });

  factory Checkin.fromJson(Map<String, dynamic> json) {
    return Checkin(
      id: json['id'] as String,
      registrationId: json['registration_id'] as String,
      workshopId: json['workshop_id'] as String,
      checkedInBy: json['checked_in_by'] as String?,
      checkedInAt: DateTime.parse(json['checked_in_at'] as String),
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'registration_id': registrationId,
    'workshop_id': workshopId,
    'checked_in_by': checkedInBy,
    'checked_in_at': checkedInAt.toIso8601String(),
    'notes': notes,
  };
}

// Offline Checkin model (cho local storage)
class OfflineCheckin {
  final String? id;
  final String registrationId;
  final String workshopId;
  final String? checkedInBy;
  final DateTime checkedInAt;
  final bool synced;

  OfflineCheckin({
    this.id,
    required this.registrationId,
    required this.workshopId,
    this.checkedInBy,
    required this.checkedInAt,
    this.synced = false,
  });

  factory OfflineCheckin.fromJson(Map<String, dynamic> json) {
    return OfflineCheckin(
      id: json['id'] as String?,
      registrationId: json['registration_id'] as String,
      workshopId: json['workshop_id'] as String,
      checkedInBy: json['checked_in_by'] as String?,
      checkedInAt: DateTime.parse(json['checked_in_at'] as String),
      synced: json['synced'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'registration_id': registrationId,
    'workshop_id': workshopId,
    'checked_in_by': checkedInBy,
    'checked_in_at': checkedInAt.toIso8601String(),
    'synced': synced,
  };
}
