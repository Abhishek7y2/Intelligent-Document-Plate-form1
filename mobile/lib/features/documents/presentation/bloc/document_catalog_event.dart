import 'package:equatable/equatable.dart';
import '../../domain/entities/document.dart';

abstract class DocumentCatalogEvent extends Equatable {
  const DocumentCatalogEvent();

  @override
  List<Object?> get props => [];
}

class DocumentsFetchRequested extends DocumentCatalogEvent {
  const DocumentsFetchRequested();
}

class DocumentsNextPageRequested extends DocumentCatalogEvent {
  const DocumentsNextPageRequested();
}

class DocumentFilterChanged extends DocumentCatalogEvent {
  final DocumentFilter filter;

  const DocumentFilterChanged(this.filter);

  @override
  List<Object?> get props => [filter];
}

class DocumentsRefreshRequested extends DocumentCatalogEvent {
  const DocumentsRefreshRequested();
}
