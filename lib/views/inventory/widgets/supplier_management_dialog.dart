import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../models/supplier_model.dart';
import '../../../../providers/purchase_provider.dart';

class SupplierManagementDialog extends ConsumerStatefulWidget {
  const SupplierManagementDialog({super.key});

  @override
  ConsumerState<SupplierManagementDialog> createState() => _SupplierManagementDialogState();
}

class _SupplierManagementDialogState extends ConsumerState<SupplierManagementDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _contactPersonController = TextEditingController();
  final _noteController = TextEditingController();

  SupplierModel? _editingSupplier;
  bool _isCreating = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _contactPersonController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  void _resetForm() {
    setState(() {
      _editingSupplier = null;
      _isCreating = false;
      _nameController.clear();
      _phoneController.clear();
      _addressController.clear();
      _contactPersonController.clear();
      _noteController.clear();
    });
  }

  void _startEdit(SupplierModel s) {
    setState(() {
      _editingSupplier = s;
      _isCreating = true;
      _nameController.text = s.name;
      _phoneController.text = s.phone ?? '';
      _addressController.text = s.address ?? '';
      _contactPersonController.text = s.contactPerson ?? '';
      _noteController.text = s.note ?? '';
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_editingSupplier == null) {
      final res = await ref.read(purchaseProvider.notifier).createSupplier(
            name: _nameController.text,
            phone: _phoneController.text,
            address: _addressController.text,
            contactPerson: _contactPersonController.text,
            note: _noteController.text,
          );
      if (res != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('ເພີ່ມຜູ້ສະໜອງ "${res.name}" ສຳເລັດແລ້ວ!'),
            backgroundColor: const Color(0xFF0F766E),
          ),
        );
        _resetForm();
      }
    } else {
      final ok = await ref.read(purchaseProvider.notifier).updateSupplier(
            id: _editingSupplier!.id,
            name: _nameController.text,
            phone: _phoneController.text,
            address: _addressController.text,
            contactPerson: _contactPersonController.text,
            note: _noteController.text,
          );
      if (ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('ອັບເດດຂໍ້ມູນຜູ້ສະໜອງສຳເລັດແລ້ວ!'),
            backgroundColor: Color(0xFF0F766E),
          ),
        );
        _resetForm();
      }
    }
  }

  Future<void> _confirmDelete(SupplierModel s) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ຢືນຢັນການລຶບຜູ້ສະໜອງ'),
        content: Text('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບຜູ້ສະໜອງ "${s.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('ຍົກເລີກ'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('ລຶບ', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      final err = await ref.read(purchaseProvider.notifier).deleteSupplierSafely(s.id);
      if (err != null && mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: Colors.amber),
                SizedBox(width: 8),
                Text('ແຈ້ງເຕືອນຄວາມປອດໄພ'),
              ],
            ),
            content: Text(err),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('ຕົກລົງ'),
              ),
            ],
          ),
        );
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('ລຶບຜູ້ສະໜອງ "${s.name}" ຮຽບຮ້ອຍແລ້ວ!'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(purchaseProvider);
    final suppliers = state.suppliers;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 820, maxHeight: 680),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.local_shipping_rounded, color: Color(0xFF0F766E), size: 26),
                      SizedBox(width: 10),
                      Text(
                        'ຈັດການແຫຼ່ງສະໜອງສິນຄ້າ (Suppliers)',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const Divider(height: 24),

              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Left list of suppliers (50%)
                    Expanded(
                      flex: 5,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'ລາຍຊື່ຜູ້ສະໜອງ (${suppliers.length})',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: Color(0xFF475569),
                                ),
                              ),
                              if (!_isCreating)
                                ElevatedButton.icon(
                                  onPressed: () {
                                    _resetForm();
                                    setState(() => _isCreating = true);
                                  },
                                  icon: const Icon(Icons.add, size: 16, color: Colors.white),
                                  label: const Text('ເພີ່ມໃໝ່', style: TextStyle(color: Colors.white, fontSize: 12)),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF0F766E),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Expanded(
                            child: suppliers.isEmpty
                                ? const Center(
                                    child: Text(
                                      'ຍັງບໍ່ມີຂໍ້ມູນຜູ້ສະໜອງສິນຄ້າ',
                                      style: TextStyle(color: Colors.grey, fontSize: 13),
                                    ),
                                  )
                                : ListView.separated(
                                    itemCount: suppliers.length,
                                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                                    itemBuilder: (ctx, i) {
                                      final s = suppliers[i];
                                      final isSelected = _editingSupplier?.id == s.id;
                                      return Container(
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: isSelected ? const Color(0xFFF0FDFA) : const Color(0xFFF8FAFC),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(
                                            color: isSelected ? const Color(0xFF0F766E) : const Color(0xFFE2E8F0),
                                            width: isSelected ? 1.5 : 1,
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    s.name,
                                                    style: const TextStyle(
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 13,
                                                      color: Color(0xFF0F172A),
                                                    ),
                                                  ),
                                                  if (s.phone != null && s.phone!.isNotEmpty) ...[
                                                    const SizedBox(height: 2),
                                                    Text(
                                                      '📞 ${s.phone}',
                                                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                                    ),
                                                  ],
                                                  if (s.address != null && s.address!.isNotEmpty) ...[
                                                    const SizedBox(height: 2),
                                                    Text(
                                                      '📍 ${s.address}',
                                                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                                    ),
                                                  ],
                                                ],
                                              ),
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF0F766E)),
                                              onPressed: () => _startEdit(s),
                                              tooltip: 'ແກ້ໄຂ',
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Colors.red),
                                              onPressed: () => _confirmDelete(s),
                                              tooltip: 'ລຶບ',
                                            ),
                                          ],
                                        ),
                                      );
                                    },
                                  ),
                          ),
                        ],
                      ),
                    ),
                    const VerticalDivider(width: 32),

                    // Right editor form (50%)
                    Expanded(
                      flex: 5,
                      child: SingleChildScrollView(
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                _editingSupplier == null ? 'ເພີ່ມແຫຼ່ງສະໜອງໃໝ່' : 'ແກ້ໄຂຂໍ້ມູນ: ${_editingSupplier!.name}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                              const SizedBox(height: 14),

                              // Name
                              TextFormField(
                                controller: _nameController,
                                decoration: InputDecoration(
                                  labelText: 'ຊື່ແຫຼ່ງສິນຄ້າ / ຜູ້ສະໜອງ *',
                                  hintText: 'ເຊັ່ນ: Friendship Supermarket, ບໍລິສັດ ເບຍລາວ...',
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                  isDense: true,
                                ),
                                validator: (val) {
                                  if (val == null || val.trim().isEmpty) {
                                    return 'ກະລຸນາປ້ອນຊື່ຜູ້ສະໜອງ';
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 12),

                              // Phone
                              TextFormField(
                                controller: _phoneController,
                                decoration: InputDecoration(
                                  labelText: 'ເບີໂທລະສັບ',
                                  hintText: '020 5555 1234',
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                  isDense: true,
                                ),
                              ),
                              const SizedBox(height: 12),

                              // Address
                              TextFormField(
                                controller: _addressController,
                                decoration: InputDecoration(
                                  labelText: 'ທີ່ຢູ່ / ສາງສິນຄ້າ',
                                  hintText: 'ບ້ານ ໂພນຕ້ອງ, ນະຄອນຫຼວງວຽງຈັນ...',
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                  isDense: true,
                                ),
                              ),
                              const SizedBox(height: 12),

                              // Note
                              TextFormField(
                                controller: _noteController,
                                maxLines: 2,
                                decoration: InputDecoration(
                                  labelText: 'ໝາຍເຫດ / ຂໍ້ຕົກລົງ',
                                  hintText: 'ເຊັ່ນ: ໃຫ້ເຄຣດິດ 30 ວັນ, ສົ່ງຟຣີຮອດຮ້ານ...',
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                  isDense: true,
                                ),
                              ),
                              const SizedBox(height: 18),

                              // Actions
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  if (_editingSupplier != null || _isCreating)
                                    TextButton(
                                      onPressed: _resetForm,
                                      child: const Text('ລ້າງຟອມ'),
                                    ),
                                  const SizedBox(width: 8),
                                  ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF0F766E),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                                    ),
                                    onPressed: _submit,
                                    child: Text(
                                      _editingSupplier == null ? 'ບັນທຶກຜູ້ສະໜອງ' : 'ອັບເດດຂໍ້ມູນ',
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
