import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  CreditCard, 
  Split, 
  Plus, 
  Trash2, 
  Edit3, 
  Receipt, 
  User,
  Building2,
  Calendar,
  IndianRupee
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

interface Charge {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  assignedTo?: string;
}

interface FolioSplit {
  id: string;
  name: string;
  type: 'individual' | 'company' | 'master';
  percentage?: number;
  fixedAmount?: number;
  charges: Charge[];
  totalAmount: number;
  paymentMethod?: string;
}

interface Reservation {
  id: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  totalCharges: number;
}

export const SplitFolioManager: React.FC = () => {
  const [selectedReservation, setSelectedReservation] = useState<string>('');
  const [folioSplits, setFolioSplits] = useState<FolioSplit[]>([]);
  const [unassignedCharges, setUnassignedCharges] = useState<Charge[]>([]);
  const [showAddSplit, setShowAddSplit] = useState(false);
  const [newSplitName, setNewSplitName] = useState('');
  const [newSplitType, setNewSplitType] = useState<'individual' | 'company' | 'master'>('individual');
  const [splitMethod, setSplitMethod] = useState<'percentage' | 'fixed' | 'manual'>('percentage');
  const [reservations] = useState<Reservation[]>([]);

  useEffect(() => {
    if (selectedReservation) {
      setUnassignedCharges([]);
      setFolioSplits([
        {
          id: 'master',
          name: 'Master Folio',
          type: 'master',
          charges: [],
          totalAmount: 0
        }
      ]);
    }
  }, [selectedReservation]);

  const addFolioSplit = () => {
    if (!newSplitName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the folio split",
        variant: "destructive"
      });
      return;
    }

    const newSplit: FolioSplit = {
      id: Date.now().toString(),
      name: newSplitName,
      type: newSplitType,
      charges: [],
      totalAmount: 0,
      ...(splitMethod === 'percentage' && { percentage: 0 }),
      ...(splitMethod === 'fixed' && { fixedAmount: 0 })
    };

    setFolioSplits([...folioSplits, newSplit]);
    setNewSplitName('');
    setShowAddSplit(false);
    
    toast({
      title: "Success",
      description: "New folio split created successfully"
    });
  };

  const assignChargeToFolio = (chargeId: string, folioId: string) => {
    const charge = unassignedCharges.find(c => c.id === chargeId);
    if (!charge) return;

    setUnassignedCharges(unassignedCharges.filter(c => c.id !== chargeId));
    
    setFolioSplits(folioSplits.map(folio => {
      if (folio.id === folioId) {
        const updatedCharges = [...folio.charges, charge];
        return {
          ...folio,
          charges: updatedCharges,
          totalAmount: updatedCharges.reduce((sum, c) => sum + c.amount, 0)
        };
      }
      return folio;
    }));

    toast({
      title: "Charge Assigned",
      description: `Charge assigned to ${folioSplits.find(f => f.id === folioId)?.name}`
    });
  };

  const removeChargeFromFolio = (chargeId: string, folioId: string) => {
    const folio = folioSplits.find(f => f.id === folioId);
    const charge = folio?.charges.find(c => c.id === chargeId);
    if (!charge) return;

    setFolioSplits(folioSplits.map(f => {
      if (f.id === folioId) {
        const updatedCharges = f.charges.filter(c => c.id !== chargeId);
        return {
          ...f,
          charges: updatedCharges,
          totalAmount: updatedCharges.reduce((sum, c) => sum + c.amount, 0)
        };
      }
      return f;
    }));

    setUnassignedCharges([...unassignedCharges, charge]);
  };

  const deleteFolioSplit = (folioId: string) => {
    const folio = folioSplits.find(f => f.id === folioId);
    if (!folio || folio.type === 'master') return;

    setUnassignedCharges([...unassignedCharges, ...folio.charges]);
    setFolioSplits(folioSplits.filter(f => f.id !== folioId));
    
    toast({
      title: "Folio Split Deleted",
      description: "Charges moved back to unassigned"
    });
  };

  const applyPercentageSplit = () => {
    const totalAmount = unassignedCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const splitCount = folioSplits.filter(f => f.type !== 'master').length;
    const percentagePerSplit = 100 / splitCount;

    folioSplits.forEach(folio => {
      if (folio.type !== 'master') {
        folio.percentage = percentagePerSplit;
        const splitAmount = (totalAmount * percentagePerSplit) / 100;
        folio.totalAmount = splitAmount;
      }
    });

    setFolioSplits([...folioSplits]);
    toast({
      title: "Split Applied",
      description: "Charges split equally by percentage"
    });
  };

  const generateFolioReports = () => {
    toast({
      title: "Reports Generated",
      description: "Individual folio reports have been generated for printing"
    });
  };

  const totalAssignedAmount = folioSplits.reduce((sum, folio) => sum + folio.totalAmount, 0);
  const totalUnassignedAmount = unassignedCharges.reduce((sum, charge) => sum + charge.amount, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Split Folio Manager</h2>
        <div className="flex gap-2">
          <Button onClick={applyPercentageSplit} variant="outline">
            <Split className="mr-2 h-4 w-4" />
            Auto Split
          </Button>
          <Button onClick={generateFolioReports}>
            <Receipt className="mr-2 h-4 w-4" />
            Generate Reports
          </Button>
        </div>
      </div>

      {/* Configuration notice */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Split className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Split Folio Feature Requires Configuration</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              The split folio API is not yet configured for this property. Contact your system administrator to enable folio splitting capabilities.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Reservation Selection (hidden until backend is ready) */}
      <Card className="hidden">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="mr-2 h-5 w-5" />
            Select Reservation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={selectedReservation} onValueChange={setSelectedReservation}>
              <SelectTrigger>
                <SelectValue placeholder="Choose reservation..." />
              </SelectTrigger>
              <SelectContent>
                {reservations.map(res => (
                  <SelectItem key={res.id} value={res.id}>
                    {res.guestName} - Room {res.roomNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedReservation && (
              <>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">
                    Total: ${totalAssignedAmount + totalUnassignedAmount}
                  </Badge>
                  <Badge variant={totalUnassignedAmount > 0 ? "destructive" : "default"}>
                    Unassigned: ${totalUnassignedAmount}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    Assigned: ${totalAssignedAmount}
                  </Badge>
                  <Badge variant="secondary">
                    Splits: {folioSplits.length - 1}
                  </Badge>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedReservation && (
        <>
          {/* Unassigned Charges */}
          {unassignedCharges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <IndianRupee className="mr-2 h-5 w-5" />
                  Unassigned Charges
                  <Badge variant="destructive" className="ml-2">
                    {unassignedCharges.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {unassignedCharges.map(charge => (
                    <div key={charge.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{charge.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {charge.category} • {charge.date}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-bold">${charge.amount}</span>
                        <Select onValueChange={(folioId) => assignChargeToFolio(charge.id, folioId)}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Assign to..." />
                          </SelectTrigger>
                          <SelectContent>
                            {folioSplits.map(folio => (
                              <SelectItem key={folio.id} value={folio.id}>
                                {folio.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Folio Splits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {folioSplits.map(folio => (
              <Card key={folio.id} className={folio.type === 'master' ? 'border-blue-200' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      {folio.type === 'individual' && <User className="mr-2 h-5 w-5" />}
                      {folio.type === 'company' && <Building2 className="mr-2 h-5 w-5" />}
                      {folio.type === 'master' && <Receipt className="mr-2 h-5 w-5" />}
                      {folio.name}
                      <Badge variant={folio.type === 'master' ? 'default' : 'secondary'} className="ml-2">
                        {folio.type}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-lg">${folio.totalAmount.toFixed(2)}</span>
                      {folio.type !== 'master' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFolioSplit(folio.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {folio.percentage && (
                    <div className="text-sm text-muted-foreground">
                      Split: {folio.percentage}%
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {folio.charges.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No charges assigned</p>
                    ) : (
                      folio.charges.map(charge => (
                        <div key={charge.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{charge.description}</div>
                            <div className="text-xs text-muted-foreground">
                              {charge.category} • {charge.date}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold">${charge.amount}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeChargeFromFolio(charge.id, folio.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add New Split */}
            <Card className="border-dashed">
              <CardContent className="p-6">
                {!showAddSplit ? (
                  <Button
                    variant="ghost"
                    className="w-full h-full min-h-[200px] border-dashed border-2"
                    onClick={() => setShowAddSplit(true)}
                  >
                    <div className="text-center">
                      <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <div className="font-medium">Add New Split</div>
                      <div className="text-sm text-muted-foreground">Create individual or company folio</div>
                    </div>
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <Input
                      placeholder="Split name..."
                      value={newSplitName}
                      onChange={(e) => setNewSplitName(e.target.value)}
                    />
                    <Select value={newSplitType} onValueChange={(value: Record<string, unknown>) => setNewSplitType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual Guest</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex space-x-2">
                      <Button onClick={addFolioSplit} className="flex-1">
                        Create Split
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddSplit(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};