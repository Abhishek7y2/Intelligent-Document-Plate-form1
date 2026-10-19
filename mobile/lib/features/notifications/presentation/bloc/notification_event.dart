import 'package:equatable/equatable.dart';
import '../../domain/entities/notification_item.dart';

abstract class NotificationEvent extends Equatable {
  const NotificationEvent();

  @override
  List<Object?> get props => [];
}

class NotificationsFetchRequested extends NotificationEvent {
  final NotificationCategory? category;
  final bool? unreadOnly;

  const NotificationsFetchRequested({this.category, this.unreadOnly});

  @override
  List<Object?> get props => [category, unreadOnly];
}

class NotificationMarkReadRequested extends NotificationEvent {
  final String id;

  const NotificationMarkReadRequested(this.id);

  @override
  List<Object?> get props => [id];
}

class NotificationMarkAllReadRequested extends NotificationEvent {
  const NotificationMarkAllReadRequested();
}

class NotificationFilterChanged extends NotificationEvent {
  final NotificationCategory? category;
  final bool? unreadOnly;

  const NotificationFilterChanged({this.category, this.unreadOnly});

  @override
  List<Object?> get props => [category, unreadOnly];
}

class NotificationStreamSubscribed extends NotificationEvent {
  const NotificationStreamSubscribed();
}

class NotificationReceivedFromStream extends NotificationEvent {
  final NotificationItem notification;

  const NotificationReceivedFromStream(this.notification);

  @override
  List<Object?> get props => [notification];
}

