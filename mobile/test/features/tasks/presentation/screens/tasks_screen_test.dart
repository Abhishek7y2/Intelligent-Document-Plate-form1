import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/tasks/domain/entities/task_entity.dart';
import 'package:docunexa_mobile/features/tasks/presentation/bloc/task_bloc.dart';
import 'package:docunexa_mobile/features/tasks/presentation/bloc/task_event.dart';
import 'package:docunexa_mobile/features/tasks/presentation/bloc/task_state.dart';
import 'package:docunexa_mobile/features/tasks/presentation/screens/tasks_screen.dart';

class MockTaskBloc extends MockBloc<TaskEvent, TaskState> implements TaskBloc {}

void main() {
  late MockTaskBloc mockBloc;

  final sampleTask = TaskItem(
    taskId: 'TASK-1',
    tenantId: 'tenant-1',
    title: 'Validate supplier tax ID',
    description: 'Ensure W-9 form matches IRS database',
    assigneeName: 'Alex Reviewer',
    status: TaskStatus.open,
    priority: TaskPriority.high,
    createdAt: DateTime.parse('2026-10-17T10:00:00Z'),
    updatedAt: DateTime.parse('2026-10-17T10:00:00Z'),
  );

  setUp(() {
    mockBloc = MockTaskBloc();
  });

  Widget buildTestableWidget(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  testWidgets('renders empty state when no tasks exist', (tester) async {
    when(() => mockBloc.state).thenReturn(const TaskState(
      tasks: [],
      isLoading: false,
    ));

    await tester.pumpWidget(buildTestableWidget(TasksScreen(bloc: mockBloc)));

    expect(find.text('Tasks & Collaboration'), findsOneWidget);
    expect(find.text('No tasks found'), findsOneWidget);
  });

  testWidgets('renders task card with title, priority and status', (tester) async {
    when(() => mockBloc.state).thenReturn(TaskState(
      tasks: [sampleTask],
      isLoading: false,
    ));

    await tester.pumpWidget(buildTestableWidget(TasksScreen(bloc: mockBloc)));

    expect(find.text('Validate supplier tax ID'), findsOneWidget);
    expect(find.text('Ensure W-9 form matches IRS database'), findsOneWidget);
    expect(find.text('HIGH'), findsOneWidget);
    expect(find.text('Open'), findsOneWidget);
    expect(find.text('Alex Reviewer'), findsOneWidget);
  });
}
