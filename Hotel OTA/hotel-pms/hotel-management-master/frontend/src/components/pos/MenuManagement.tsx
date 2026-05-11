import React, { useState, useEffect } from 'react';
import { formatCurrency } from '@/utils/currencyUtils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, UtensilsCrossed, Coffee, Pizza, Cake, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface MenuItem {
  itemId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isActive: boolean;
  image?: string;
}

interface Menu {
  _id: string;
  menuId: string;
  name: string;
  outlet: unknown;
  type: string;
  isActive: boolean;
  items: MenuItem[];
}

interface Outlet {
  _id: string;
  name: string;
  type: string;
}

const MenuManagement: React.FC = () => {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('');
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [menuForm, setMenuForm] = useState({
    name: '',
    outlet: '',
    type: 'all_day',
    description: ''
  });

  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'appetizers',
    isActive: true
  });

  useEffect(() => {
    fetchOutlets();
  }, []);

  useEffect(() => {
    if (selectedOutlet) {
      fetchMenus();
    }
  }, [selectedOutlet]);

  const fetchOutlets = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/pos/outlets');
      if (response.data.success) {
        setOutlets(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedOutlet(response.data.data[0]._id);
        }
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMenus = async () => {
    if (!selectedOutlet) return;
    
    try {
      const response = await api.get(`/pos/menus/outlet/${selectedOutlet}`);
      if (response.data.success) {
        setMenus(response.data.data);
      }
    } catch {
      // Error handled silently
    }
  };

  const handleCreateMenu = async () => {
    try {
      const response = await api.post('/pos/menus', {
        ...menuForm,
        outlet: selectedOutlet,
        items: []
      });
      
      if (response.data.success) {
        fetchMenus();
        setIsCreateMenuOpen(false);
        resetMenuForm();
        alert('Menu created successfully!');
      }
    } catch (error) {
      alert('Error creating menu');
    }
  };

  const handleAddMenuItem = async () => {
    if (!selectedMenu) return;

    try {
      const response = await api.post(`/pos/menus/${selectedMenu._id}/items`, itemForm);
      
      if (response.data.success) {
        fetchMenus();
        setIsAddItemOpen(false);
        resetItemForm();
        alert('Menu item added successfully!');
      }
    } catch (error) {
      alert('Error adding menu item');
    }
  };

  const resetMenuForm = () => {
    setMenuForm({
      name: '',
      outlet: '',
      type: 'all_day',
      description: ''
    });
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      description: '',
      price: 0,
      category: 'appetizers',
      isActive: true
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'beverages': return <Coffee className="w-4 h-4" />;
      case 'appetizers': return <Pizza className="w-4 h-4" />;
      case 'main course': return <UtensilsCrossed className="w-4 h-4" />;
      case 'desserts': return <Cake className="w-4 h-4" />;
      default: return <Pizza className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'beverages': 'bg-blue-100 text-blue-800',
      'appetizers': 'bg-orange-100 text-orange-800',
      'main course': 'bg-green-100 text-green-800',
      'desserts': 'bg-pink-100 text-pink-800'
    };
    return colors[category.toLowerCase() as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading menus...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Menu Management</h1>
        <Dialog open={isCreateMenuOpen} onOpenChange={setIsCreateMenuOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Menu
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Menu</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="menu-name">Menu Name</Label>
                <Input
                  id="menu-name"
                  value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  placeholder="Enter menu name"
                />
              </div>
              <div>
                <Label htmlFor="menu-type">Menu Type</Label>
                <select
                  id="menu-type"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={menuForm.type}
                  onChange={(e) => setMenuForm({ ...menuForm, type: e.target.value })}
                >
                  <option value="all_day">All Day</option>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="beverages">Beverages</option>
                </select>
              </div>
              <div>
                <Label htmlFor="menu-description">Description</Label>
                <Input
                  id="menu-description"
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  placeholder="Enter menu description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateMenuOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateMenu}>Create Menu</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Outlet Selection */}
      <div className="flex items-center space-x-4">
        <Label>Select Outlet:</Label>
        <select
          className="p-2 border border-gray-300 rounded-md"
          value={selectedOutlet}
          onChange={(e) => setSelectedOutlet(e.target.value)}
        >
          <option value="">Select outlet</option>
          {outlets.map((outlet) => (
            <option key={outlet._id} value={outlet._id}>
              {outlet.name}
            </option>
          ))}
        </select>
      </div>

      {/* Menus Grid */}
      {selectedOutlet && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">
            Menus for {outlets.find(o => o._id === selectedOutlet)?.name}
          </h2>
          
          {menus.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No menus found for this outlet.</p>
              <p className="text-sm text-gray-400 mt-2">Create your first menu to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {menus.map((menu) => (
                <Card key={menu._id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{menu.name}</CardTitle>
                        <Badge variant="outline">{menu.type.replace('_', ' ')}</Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedMenu(menu);
                          setIsAddItemOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Item
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">Items: {menu.items?.length || 0}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Array.from(new Set(menu.items?.map(item => item.category) || [])).map((category) => (
                            <Badge
                              key={category}
                              className={`${getCategoryColor(category)} text-xs`}
                              variant="secondary"
                            >
                              {getCategoryIcon(category)}
                              <span className="ml-1">{category}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {menu.items && menu.items.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium text-sm mb-2">Recent Items:</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {menu.items.slice(0, 3).map((item) => (
                              <div key={item.itemId} className="flex justify-between text-xs">
                                <span>{item.name}</span>
                                <span className="font-medium">{formatCurrency(item.price)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Menu Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Item to {selectedMenu?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="item-name">Item Name</Label>
              <Input
                id="item-name"
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                placeholder="Enter item name"
              />
            </div>
            <div>
              <Label htmlFor="item-description">Description</Label>
              <Input
                id="item-description"
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                placeholder="Enter item description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="item-price">Price (₹)</Label>
                <Input
                  id="item-price"
                  type="number"
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="item-category">Category</Label>
                <select
                  id="item-category"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                >
                  <option value="appetizers">Appetizers</option>
                  <option value="main course">Main Course</option>
                  <option value="desserts">Desserts</option>
                  <option value="beverages">Beverages</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMenuItem}>Add Item</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MenuManagement;