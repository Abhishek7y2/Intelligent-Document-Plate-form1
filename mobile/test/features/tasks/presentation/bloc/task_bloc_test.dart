import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/features/tasks/domain/entities/task_entity.dart';
import 'package:docunexa_mobile/features/tasks/domain/repositories/task_repository.dart';
import 'package:docunexa_mobile/features/tasks/presentation/bloc/task_bloc.dart';
import 'package:docunexa_mobile/features/tasks/presentation/bloc/task_event.dart';
import 'package:docunexa_mobile/features/tasks/presentation/bloc/task_state.dart';

class MockTaskRepository extends Mock implements TaskRepository {}

void main() {
  late MockTaskRepository mockRepository;
  late TaskBloc bloc;

  final sampleTask = TaskItem(
    taskId: 'task-101',
    tenantId: 'tenant-1',
    title: 'Review invoice discrepancy',
    description: 'Line item 3 differs from purchase order PO-889',
    assigneeId: 'user-1',
    assigneeName: 'Alex Reviewer',
    status: TaskStatus.open,
    priority: TaskPriority.high,
    dueDate: DateTime.parse('2026-10-20T17:00:00Z'),
    createdAt: DateTime.parse('2026-10-17T09:00:00Z'),
    updatedAt: DateTime.parse('2026-10-17T09:00:00Z'),
    comments: [
      TaskComment(
        commentId: 'comm-1',
        taskId: 'task-101',
        authorId: 'user-1',
        authorName: 'Alex Reviewer',
        commentText: 'Initial discrepancy noted.',
        createdAt: DateTime.parse('2026-10-17T09:30:00Z'),
      ),
    ],
  );

  setUp(() {
    mockRepository = MockTaskRepository();
    bloc = TaskBloc(repository: mockRepository);
  });

  tearDown(() {
    bloc.close();
  });

  group('TaskBloc Tests', () {
    test('initial state is default TaskState', () {
      expect(bloc.state, const TaskState());
    });

    blocTest<TaskBloc, TaskState>(
      'fetches tasks list on TasksFetchRequested',
      build: () {
        when(() => mockRepository.getTasks(
              mine: false,
              overdue: false,
              status: null,
              priority: null,
            )).thenAnswer((_) async => [sampleTask]);
        return bloc;
      },
      act: (b) => b.add(const TasksFetchRequested()),
      expect: () => [
        const TaskState(isLoading: true),
        TaskState(
          isLoading: false,
          tasks: [sampleTask],
        ),
      ],
    );

    blocTest<TaskBloc, TaskState>(
      'fetches task details on TaskDetailRequested',
      build: () {
        when(() => mockRepository.getTaskDetails('task-101'))
            .thenAnswer((_) async => sampleTask);
        return bloc;
      },
      act: (b) => b.add(const TaskDetailRequested('task-101')),
      expect: () => [
        const TaskState(isLoadingDetail: true),
        TaskState(
          isLoadingDetail: false,
          selectedTask: sampleTask,
        ),
      ],
    );

    blocTest<TaskBloc, TaskState>(
      'creates new task on TaskCreateRequested',
      build: () {
        when(() => mockRepository.createTask(
              title: 'New urgent task',
              description: 'Urgent check',
              assigneeId: null,
              assigneeName: null,
              priority: TaskPriority.urgent,
              dueDate: null,
              documentId: null,
            )).thenAnswer((_) async => sampleTask);
        return bloc;
      },
      act: (b) => b.add(const TaskCreateRequested(
        title: 'New urgent task',
        description: 'Urgent check',
        priority: TaskPriority.urgent,
      )),
      expect: () => [
        const TaskState(isSubmittingAction: true),
        TaskState(
          isSubmittingAction: false,
          tasks: [sampleTask],
          successMessage: 'Task created successfully',
        ),
      ],
    );

    blocTest<TaskBloc, TaskState>(
      'adds comment to selected task on TaskAddCommentRequested',
      seed: () => TaskState(selectedTask: sampleTask),
      build: () {
        final newComment = TaskComment(
          commentId: 'comm-2',
          taskId: 'task-101',
          authorId: 'user-2',
          authorName: 'Manager Jane',
          commentText: 'Acknowledged and approved.',
          createdAt: DateTime.parse('2026-10-17T10:00:00Z'),
        );
        when(() => mockRepository.addTaskComment(
              taskId: 'task-101',
              commentText: 'Acknowledged and approved.',
            )).thenAnswer((_) async => newComment);
        return bloc;
      },
      act: (b) => b.add(const TaskAddCommentRequested(
        taskId: 'task-101',
        commentText: 'Acknowledged and approved.',
      )),
      expect: () => [
        TaskState(
          selectedTask: sampleTask,
          isSubmittingAction: true,
        ),
        TaskState(
          selectedTask: sampleTask.copyWith(
            comments: [
              ...sampleTask.comments,
              TaskComment(
                commentId: 'comm-2',
                taskId: 'task-101',
                authorId: 'user-2',
                authorName: 'Manager Jane',
                commentText: 'Acknowledged and approved.',
                createdAt: DateTime.parse('2026-10-17T10:00:00Z'),
              ),
            ],
          ),
          isSubmittingAction: false,
          successMessage: 'Comment posted',
        ),
      ],
    );
  });
}
