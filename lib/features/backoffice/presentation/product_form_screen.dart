import 'package:flutter/material.dart';
import 'widgets/product_entry_form_modal.dart';

export 'widgets/product_entry_form_modal.dart';

/// Screen / Modal wrapper for Product Entry Form adhering to SPEC_PRODUCT_FORM_MODAL.md
class ProductFormScreen extends StatelessWidget {
  final dynamic productToEdit;
  final VoidCallback? onSaved;
  final VoidCallback? onClose;

  const ProductFormScreen({
    super.key,
    this.productToEdit,
    this.onSaved,
    this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return ProductEntryFormModal(
      productToEdit: productToEdit,
      onSaved: onSaved,
      onClose: onClose,
    );
  }
}
